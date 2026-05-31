import { DateTime } from "luxon";
import { createReservation } from "@/features/booking";
import { computeAvailability } from "@/features/availability";
import { ensureCustomer, getRestaurantBySlug, loadAvailabilityContext } from "@/features/repositories";
import { getPool } from "@/lib/db";
import { getWhatsAppSender } from "@/lib/whatsapp";

type BotSlot = {
  time: string;
  serviceId: string;
};

type BotState = {
  step?: "party" | "date" | "slot" | "name";
  partySize?: number;
  date?: string;
  slots?: BotSlot[];
  selectedSlot?: BotSlot;
};

type IncomingMessage = {
  phoneNumberId?: string | null;
  from: string;
  body: string;
  messageId?: string | null;
  contactName?: string | null;
  raw?: unknown;
};

type RestaurantRow = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  settings: Record<string, unknown>;
};

const DUPLICATE_MESSAGE = "23505";

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();
}

function whatsappPhone(value: string) {
  const digits = value.replace(/[^\d]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function parsePartySize(value: string) {
  const match = value.match(/\d+/);
  if (!match) return null;
  const partySize = Number(match[0]);
  return Number.isInteger(partySize) && partySize > 0 && partySize <= 30 ? partySize : null;
}

function parseDateInput(value: string, timezone: string) {
  const text = normalizeText(value);
  const today = DateTime.now().setZone(timezone).startOf("day");
  if (text === "hoy" || text === "today") return today.toISODate();
  if (text === "manana" || text === "tomorrow") return today.plus({ days: 1 }).toISODate();
  const iso = DateTime.fromISO(text, { zone: timezone });
  if (iso.isValid) return iso.toISODate();
  const slash = DateTime.fromFormat(text, "d/L", { zone: timezone });
  if (slash.isValid) {
    const candidate = slash.set({ year: today.year });
    return (candidate < today ? candidate.plus({ years: 1 }) : candidate).toISODate();
  }
  return null;
}

function formatSlotList(slots: BotSlot[], timezone: string) {
  return slots
    .slice(0, 8)
    .map((slot, index) => `${index + 1}. ${DateTime.fromISO(slot.time).setZone(timezone).toFormat("HH:mm")}`)
    .join("\n");
}

function findSlot(value: string, slots: BotSlot[], timezone: string) {
  const byNumber = Number(value.trim());
  if (Number.isInteger(byNumber) && slots[byNumber - 1]) return slots[byNumber - 1];
  const normalized = value.trim();
  return (
    slots.find((slot) => DateTime.fromISO(slot.time).setZone(timezone).toFormat("HH:mm") === normalized) ??
    null
  );
}

async function resolveRestaurant(phoneNumberId?: string | null): Promise<RestaurantRow | null> {
  const pool = getPool();
  if (phoneNumberId) {
    const byPhone = await pool.query<RestaurantRow>(
      `SELECT id, slug, name, timezone, settings
       FROM restaurant
       WHERE settings->'whatsapp'->>'phoneNumberId' = $1
       LIMIT 1`,
      [phoneNumberId]
    );
    if (byPhone.rows[0]) return byPhone.rows[0];
  }

  const envPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const defaultSlug = process.env.WHATSAPP_DEFAULT_RESTAURANT_SLUG;
  if (defaultSlug && (!phoneNumberId || !envPhoneNumberId || phoneNumberId === envPhoneNumberId)) {
    const restaurant = await getRestaurantBySlug(defaultSlug);
    return restaurant as RestaurantRow | null;
  }

  return null;
}

async function loadOrCreateConversation(restaurant: RestaurantRow, phone: string, contactName?: string | null) {
  const customerId = contactName
    ? await ensureCustomer({ restaurantId: restaurant.id, name: contactName, phone })
    : null;

  const result = await getPool().query<{
    id: string;
    customer_id: string | null;
    state: BotState;
  }>(
    `INSERT INTO whatsapp_conversation (restaurant_id, customer_id, phone, state)
     VALUES ($1, $2, $3, '{}'::jsonb)
     ON CONFLICT (restaurant_id, phone)
     DO UPDATE SET last_message_at = now(),
                   updated_at = now(),
                   customer_id = COALESCE(whatsapp_conversation.customer_id, EXCLUDED.customer_id)
     RETURNING id, customer_id, state`,
    [restaurant.id, customerId, phone]
  );
  return result.rows[0];
}

async function saveState(conversationId: string, state: BotState, customerId?: string | null) {
  await getPool().query(
    `UPDATE whatsapp_conversation
     SET state = $2::jsonb,
         customer_id = COALESCE($3::uuid, customer_id),
         last_message_at = now(),
         updated_at = now()
     WHERE id = $1`,
    [conversationId, JSON.stringify(state), customerId ?? null]
  );
}

async function recordMessage(input: {
  conversationId: string;
  restaurantId: string;
  direction: "inbound" | "outbound";
  phone: string;
  body: string;
  metaMessageId?: string | null;
  raw?: unknown;
}) {
  await getPool().query(
    `INSERT INTO whatsapp_message
       (conversation_id, restaurant_id, direction, phone, body, meta_message_id, raw)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.conversationId,
      input.restaurantId,
      input.direction,
      input.phone,
      input.body,
      input.metaMessageId ?? null,
      JSON.stringify(input.raw ?? {})
    ]
  );
}

async function reply(conversationId: string, restaurantId: string, to: string, body: string) {
  const sent = await getWhatsAppSender().sendText({ to, body });
  await recordMessage({
    conversationId,
    restaurantId,
    direction: "outbound",
    phone: to,
    body,
    metaMessageId: sent.id ?? null
  });
}

async function getSlots(restaurant: RestaurantRow, date: string, partySize: number) {
  const context = await loadAvailabilityContext(restaurant.id, date, restaurant.timezone);
  const slots = computeAvailability({
    request: { date, partySize },
    shifts: context.shifts,
    units: context.units,
    reservations: context.reservations,
    timezone: restaurant.timezone,
    exception: context.exception
  });
  return slots.map((slot) => ({ time: slot.startsAt.toISO()!, serviceId: slot.serviceId }));
}

async function createBotReservation(input: {
  restaurant: RestaurantRow;
  conversationId: string;
  phone: string;
  name: string;
  state: BotState;
}) {
  const state = input.state;
  if (!state.date || !state.partySize || !state.selectedSlot) {
    await saveState(input.conversationId, { step: "party" });
    return `No pude cerrar esa reserva. Empecemos de nuevo: cuantas personas vienen?`;
  }

  const result = await createReservation({
    slug: input.restaurant.slug,
    date: state.date,
    time: state.selectedSlot.time,
    partySize: state.partySize,
    serviceId: state.selectedSlot.serviceId,
    zoneId: null,
    customer: { name: input.name, phone: input.phone, email: null },
    specialRequests: "Reserva creada por WhatsApp",
    source: "whatsapp"
  });

  if (!result.ok) {
    await saveState(input.conversationId, { step: "date", partySize: state.partySize });
    return "Ese horario ya no esta disponible. Decime otra fecha y buscamos de nuevo.";
  }

  const localStart = DateTime.fromISO(result.reservation.startsAt).setZone(input.restaurant.timezone);
  await saveState(input.conversationId, {}, undefined);
  return `Listo, reserva confirmada en ${input.restaurant.name} para ${state.partySize} persona(s) el ${localStart.toFormat("dd/LL")} a las ${localStart.toFormat("HH:mm")}. Codigo: ${result.reservation.id}`;
}

async function nextBotResponse(input: {
  restaurant: RestaurantRow;
  conversationId: string;
  phone: string;
  text: string;
  contactName?: string | null;
  state: BotState;
  customerId?: string | null;
}) {
  const normalized = normalizeText(input.text);
  if (["hola", "menu", "reservar", "reserva", "book", "start"].some((word) => normalized.includes(word))) {
    await saveState(input.conversationId, { step: "party" }, input.customerId);
    return `Hola, soy el asistente de ${input.restaurant.name}. Para reservar, decime cuantas personas vienen.`;
  }

  if (normalized.includes("cancel")) {
    return "Para cancelar o modificar una reserva, usa el link de gestion que recibiste en la confirmacion.";
  }

  const state = input.state.step ? input.state : { step: "party" as const };

  if (state.step === "party") {
    const partySize = parsePartySize(input.text);
    if (!partySize) return "Decime la cantidad de personas con un numero, por ejemplo: 4.";
    await saveState(input.conversationId, { step: "date", partySize }, input.customerId);
    return "Perfecto. Para que fecha? Podes responder hoy, manana o una fecha como 2026-06-15.";
  }

  if (state.step === "date") {
    const date = parseDateInput(input.text, input.restaurant.timezone);
    if (!date) return "No pude leer esa fecha. Proba con hoy, manana o AAAA-MM-DD.";
    const slots = await getSlots(input.restaurant, date, state.partySize ?? 2);
    if (!slots.length) {
      await saveState(input.conversationId, { step: "date", partySize: state.partySize }, input.customerId);
      return "No encontre horarios para esa fecha. Decime otra fecha y lo intento de nuevo.";
    }
    const nextState: BotState = { ...state, step: "slot", date, slots: slots.slice(0, 8) };
    await saveState(input.conversationId, nextState, input.customerId);
    return `Tengo estos horarios disponibles:\n${formatSlotList(nextState.slots ?? [], input.restaurant.timezone)}\nResponde con el numero de opcion.`;
  }

  if (state.step === "slot") {
    const selectedSlot = findSlot(input.text, state.slots ?? [], input.restaurant.timezone);
    if (!selectedSlot) return "Elegime una opcion de la lista, por ejemplo 1.";

    const customer = await getPool().query<{ id: string; name: string | null }>(
      "SELECT id, name FROM customer WHERE phone = $1 LIMIT 1",
      [input.phone]
    );
    const existingName = customer.rows[0]?.name || input.contactName;
    if (existingName && existingName.trim().length > 1) {
      return createBotReservation({
        restaurant: input.restaurant,
        conversationId: input.conversationId,
        phone: input.phone,
        name: existingName,
        state: { ...state, selectedSlot }
      });
    }

    await saveState(input.conversationId, { ...state, step: "name", selectedSlot }, customer.rows[0]?.id);
    return "A nombre de quien dejo la reserva?";
  }

  if (state.step === "name") {
    const name = input.text.trim();
    if (name.length < 2) return "Necesito un nombre para dejar la reserva.";
    return createBotReservation({
      restaurant: input.restaurant,
      conversationId: input.conversationId,
      phone: input.phone,
      name,
      state
    });
  }

  await saveState(input.conversationId, { step: "party" }, input.customerId);
  return `Hola, soy el asistente de ${input.restaurant.name}. Para reservar, decime cuantas personas vienen.`;
}

export async function processIncomingWhatsAppMessage(input: IncomingMessage) {
  const restaurant = await resolveRestaurant(input.phoneNumberId);
  if (!restaurant) return { ok: false as const, reason: "restaurant_not_found" };

  const phone = whatsappPhone(input.from);
  const conversation = await loadOrCreateConversation(restaurant, phone, input.contactName);

  try {
    await recordMessage({
      conversationId: conversation.id,
      restaurantId: restaurant.id,
      direction: "inbound",
      phone,
      body: input.body,
      metaMessageId: input.messageId ?? null,
      raw: input.raw
    });
  } catch (error) {
    if ((error as { code?: string }).code === DUPLICATE_MESSAGE) return { ok: true as const, duplicate: true };
    throw error;
  }

  const body = await nextBotResponse({
    restaurant,
    conversationId: conversation.id,
    phone,
    text: input.body,
    contactName: input.contactName,
    state: conversation.state ?? {},
    customerId: conversation.customer_id
  });
  await reply(conversation.id, restaurant.id, phone, body);
  return { ok: true as const };
}

export function extractWhatsAppTextMessages(payload: unknown) {
  const body = payload as {
    entry?: Array<{
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ wa_id?: string; profile?: { name?: string } }>;
          messages?: Array<{
            from?: string;
            id?: string;
            type?: string;
            text?: { body?: string };
          }>;
        };
      }>;
    }>;
  };

  const messages: IncomingMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const message of value?.messages ?? []) {
        if (message.type !== "text" || !message.from || !message.text?.body) continue;
        const contact = value?.contacts?.find((item) => item.wa_id === message.from) ?? value?.contacts?.[0];
        messages.push({
          phoneNumberId,
          from: message.from,
          body: message.text.body,
          messageId: message.id,
          contactName: contact?.profile?.name,
          raw: message
        });
      }
    }
  }
  return messages;
}
