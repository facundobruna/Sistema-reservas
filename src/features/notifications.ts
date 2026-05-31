import { DateTime } from "luxon";
import { PgBoss, type Job } from "pg-boss";
import { getPool } from "@/lib/db";
import { createDinerToken } from "@/lib/auth";
import { getEmailSender } from "@/lib/email";
import { getWhatsAppSender } from "@/lib/whatsapp";

const JOB_NAME = "notification.send";

let boss: PgBoss | null = null;

async function getBoss() {
  if (process.env.ENABLE_PG_BOSS !== "true") return null;
  if (!process.env.DATABASE_URL) return null;
  if (!boss) {
    boss = new PgBoss({ connectionString: process.env.DATABASE_URL });
    await boss.start();
  }
  return boss;
}

async function enqueueNotification(id: string, startAfter?: Date) {
  const queue = await getBoss();
  if (!queue) return;
  await queue.send(JOB_NAME, { id }, startAfter ? { startAfter } : undefined);
}

function reminderHours(settings: Record<string, unknown>) {
  const value = settings.reminderHoursBefore;
  return typeof value === "number" && value > 0 ? value : 4;
}

function whatsappNotificationsEnabled(settings: Record<string, unknown>) {
  if (process.env.WHATSAPP_ENABLE_NOTIFICATIONS === "true") return true;
  const whatsapp = settings.whatsapp as Record<string, unknown> | undefined;
  return whatsapp?.enabled === true;
}

export async function scheduleReservationNotifications(
  reservationId: string,
  restaurantSettings: Record<string, unknown>,
  startsAt: DateTime
) {
  const pool = getPool();
  const now = DateTime.utc();
  const reminderAt = startsAt.minus({ hours: reminderHours(restaurantSettings) }).toUTC();
  const values = [
    `($1, 'confirmation', 'email', now())`,
    `($1, 'reminder', 'email', GREATEST($2::timestamptz, now()))`
  ];
  if (whatsappNotificationsEnabled(restaurantSettings)) {
    values.push(
      `($1, 'confirmation', 'whatsapp', now())`,
      `($1, 'reminder', 'whatsapp', GREATEST($2::timestamptz, now()))`
    );
  }
  const rows = await pool.query<{ id: string; scheduled_for: Date }>(
    `INSERT INTO notification (reservation_id, type, channel, scheduled_for)
     VALUES ${values.join(", ")}
     RETURNING id, scheduled_for`,
    [reservationId, (reminderAt > now ? reminderAt : now).toISO()]
  );

  await Promise.all(rows.rows.map((row) => enqueueNotification(row.id, row.scheduled_for)));
}

export async function processDueNotifications(limit = 25) {
  const pool = getPool();
  const emailSender = getEmailSender();
  const whatsappSender = getWhatsAppSender();
  const due = await pool.query<{
    id: string;
    type: "confirmation" | "reminder";
    channel: "email" | "whatsapp";
    reservation_id: string;
    customer_id: string;
    customer_email: string | null;
    customer_phone: string;
    customer_name: string | null;
    restaurant_name: string;
    restaurant_slug: string;
    starts_at: Date;
    timezone: string;
  }>(
    `SELECT n.id, n.type, n.channel, n.reservation_id, c.id AS customer_id,
            c.email AS customer_email, c.phone AS customer_phone, c.name AS customer_name,
            rest.name AS restaurant_name, rest.slug AS restaurant_slug, r.starts_at, rest.timezone
     FROM notification n
     JOIN reservation r ON r.id = n.reservation_id
     JOIN restaurant rest ON rest.id = r.restaurant_id
     JOIN customer c ON c.id = r.customer_id
     WHERE n.status = 'scheduled' AND n.scheduled_for <= now()
     ORDER BY n.scheduled_for
     LIMIT $1`,
    [limit]
  );

  const results: Array<{ id: string; status: "sent" | "failed"; error?: string }> = [];

  for (const row of due.rows) {
    if (row.channel === "email" && !row.customer_email) {
      await pool.query(
        `UPDATE notification
         SET status = 'failed', last_error = 'customer has no email', attempts = attempts + 1
         WHERE id = $1`,
        [row.id]
      );
      results.push({ id: row.id, status: "failed", error: "customer has no email" });
      continue;
    }

    const localStart = DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(row.timezone);
    const subject =
      row.type === "confirmation"
        ? `Reserva confirmada en ${row.restaurant_name}`
        : `Recordatorio de reserva en ${row.restaurant_name}`;
    const text =
      row.type === "confirmation"
        ? `Hola ${row.customer_name ?? ""}, tu reserva en ${row.restaurant_name} quedo confirmada para ${localStart.toFormat("dd/LL HH:mm")}.`
        : `Hola ${row.customer_name ?? ""}, te recordamos tu reserva en ${row.restaurant_name} para ${localStart.toFormat("dd/LL HH:mm")}.`;

    try {
      const sent =
        row.channel === "email"
          ? await emailSender.send({ to: row.customer_email!, subject, text })
          : await sendWhatsAppNotification({
              sender: whatsappSender,
              to: row.customer_phone,
              type: row.type,
              text,
              restaurantName: row.restaurant_name,
              localStart,
              manageUrl: reservationManageUrl(row.restaurant_slug, row.reservation_id, row.customer_id)
            });
      await pool.query(
        `UPDATE notification
         SET status = 'sent', sent_at = now(), provider_message_id = $2, attempts = attempts + 1
         WHERE id = $1`,
        [row.id, sent.id ?? null]
      );
      results.push({ id: row.id, status: "sent" });
    } catch (error) {
      await pool.query(
        `UPDATE notification
         SET status = 'failed', last_error = $2, attempts = attempts + 1
         WHERE id = $1`,
        [row.id, error instanceof Error ? error.message : "unknown"]
      );
      results.push({ id: row.id, status: "failed", error: error instanceof Error ? error.message : "unknown" });
    }
  }

  return results;
}

function reservationManageUrl(slug: string, reservationId: string, customerId: string) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const token = createDinerToken({ type: "diner", customerId, reservationId });
  return `${appUrl}/r/${slug}/reservations/${reservationId}?token=${encodeURIComponent(token)}`;
}

async function sendWhatsAppNotification(input: {
  sender: ReturnType<typeof getWhatsAppSender>;
  to: string;
  type: "confirmation" | "reminder";
  text: string;
  restaurantName: string;
  localStart: DateTime;
  manageUrl: string;
}) {
  const templateName =
    input.type === "confirmation"
      ? process.env.WHATSAPP_TEMPLATE_CONFIRMATION
      : process.env.WHATSAPP_TEMPLATE_REMINDER;
  if (templateName) {
    return input.sender.sendTemplate({
      to: input.to,
      name: templateName,
      languageCode: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "es_AR",
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: input.restaurantName },
            { type: "text", text: input.localStart.toFormat("dd/LL HH:mm") },
            { type: "text", text: input.manageUrl }
          ]
        }
      ]
    });
  }

  return input.sender.sendText({ to: input.to, body: `${input.text}\nGestionar: ${input.manageUrl}` });
}

export async function registerNotificationWorker() {
  const queue = await getBoss();
  if (!queue) return null;
  await queue.work<{ id: string }>(JOB_NAME, async (jobs: Job<{ id: string }>[]) => {
    for (let index = 0; index < jobs.length; index += 1) {
      await processDueNotifications(10);
    }
  });
  return queue;
}
