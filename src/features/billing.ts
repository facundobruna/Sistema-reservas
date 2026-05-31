import { DateTime } from "luxon";
import { getPool } from "@/lib/db";
import { isMercadoPagoConfigured } from "@/lib/mercado-pago";

export type PlanKey = "starter" | "growth" | "scale";

type BillingStatus =
  | "trialing"
  | "pending"
  | "authorized"
  | "active"
  | "paused"
  | "canceled"
  | "cancelled"
  | "inactive"
  | "finished"
  | "expired";

export type BillingSubscriptionRow = {
  restaurant_id: string;
  plan_key: PlanKey;
  status: BillingStatus;
  mercadopago_payer_id: string | null;
  mercadopago_preapproval_id: string | null;
  mercadopago_plan_id: string | null;
  mercadopago_payer_email: string | null;
  mercadopago_init_point: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  next_payment_at: Date | null;
  trial_ends_at: Date | null;
  cancelled_at: Date | null;
  monthly_reservation_limit: number;
  mesa_limit: number;
  created_at: Date;
  updated_at: Date;
};

export type BillingUsage = {
  mesas: number;
  reservationsThisMonth: number;
};

export type MercadoPagoPreapproval = {
  id: string;
  preapproval_plan_id?: string | null;
  payer_id?: string | number | null;
  payer_email?: string | null;
  external_reference?: string | number | null;
  init_point?: string | null;
  back_url?: string | null;
  status?: string | null;
  date_created?: string | null;
  last_modified?: string | null;
  next_payment_date?: string | null;
  auto_recurring?: {
    transaction_amount?: string | number | null;
    currency_id?: string | null;
    start_date?: string | null;
    end_date?: string | null;
  } | null;
};

function envNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const currencyId = process.env.MP_CURRENCY_ID || "ARS";

export const billingPlans: Record<
  PlanKey,
  {
    key: PlanKey;
    name: string;
    amount: number;
    currencyId: string;
    priceLabel: string;
    reservationLimit: number;
    mesaLimit: number;
    description: string;
  }
> = {
  starter: buildPlan({
    key: "starter",
    name: "Starter",
    amount: envNumber("MP_PLAN_STARTER_AMOUNT", 29000),
    reservationLimit: 300,
    mesaLimit: 12,
    description: "Para restaurantes chicos que quieren operar reservas web sin complejidad."
  }),
  growth: buildPlan({
    key: "growth",
    name: "Growth",
    amount: envNumber("MP_PLAN_GROWTH_AMOUNT", 69000),
    reservationLimit: 1200,
    mesaLimit: 40,
    description: "El plan recomendado para salones con varias zonas y agenda diaria activa."
  }),
  scale: buildPlan({
    key: "scale",
    name: "Scale",
    amount: envNumber("MP_PLAN_SCALE_AMOUNT", 149000),
    reservationLimit: 5000,
    mesaLimit: 120,
    description: "Para grupos grandes, alto volumen y operaciones con mayor capacidad."
  })
};

function buildPlan(input: {
  key: PlanKey;
  name: string;
  amount: number;
  reservationLimit: number;
  mesaLimit: number;
  description: string;
}) {
  return {
    ...input,
    currencyId,
    priceLabel: `${currencyId} ${new Intl.NumberFormat("es-AR").format(input.amount)}/mes`
  };
}

export function externalReferenceFor(restaurantId: string, planKey: PlanKey) {
  return `billing:${restaurantId}:${planKey}`;
}

export function planFromExternalReference(reference: string | number | null | undefined): PlanKey | null {
  const planKey = String(reference ?? "").split(":")[2];
  return planKey === "starter" || planKey === "growth" || planKey === "scale" ? planKey : null;
}

export function restaurantFromExternalReference(reference: string | number | null | undefined) {
  const parts = String(reference ?? "").split(":");
  return parts[0] === "billing" && parts[1] ? parts[1] : null;
}

export function planFromMercadoPagoAmount(amount: string | number | null | undefined): PlanKey | null {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) return null;
  const match = Object.values(billingPlans).find((plan) => plan.amount === numeric);
  return match?.key ?? null;
}

function normalizeMercadoPagoStatus(status: string | null | undefined): BillingStatus {
  if (status === "cancelled") return "canceled";
  if (
    status === "pending" ||
    status === "authorized" ||
    status === "active" ||
    status === "paused" ||
    status === "canceled" ||
    status === "inactive" ||
    status === "finished" ||
    status === "expired"
  ) {
    return status;
  }
  return "pending";
}

function dateOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isBillingUsable(subscription: BillingSubscriptionRow) {
  if (subscription.status === "active" || subscription.status === "authorized") return true;
  if (subscription.status === "trialing") {
    return !subscription.trial_ends_at || DateTime.fromJSDate(subscription.trial_ends_at).toMillis() >= Date.now();
  }
  return false;
}

export async function ensureBillingSubscription(restaurantId: string) {
  const pool = getPool();
  const existing = await pool.query<BillingSubscriptionRow>(
    "SELECT * FROM billing_subscription WHERE restaurant_id = $1",
    [restaurantId]
  );
  if (existing.rows[0]) return existing.rows[0];

  const plan = billingPlans.growth;
  const created = await pool.query<BillingSubscriptionRow>(
    `INSERT INTO billing_subscription
       (restaurant_id, plan_key, status, trial_ends_at, monthly_reservation_limit, mesa_limit)
     VALUES ($1, 'growth', 'trialing', now() + interval '14 days', $2, $3)
     RETURNING *`,
    [restaurantId, plan.reservationLimit, plan.mesaLimit]
  );
  return created.rows[0];
}

export async function getBillingUsage(restaurantId: string): Promise<BillingUsage> {
  const pool = getPool();
  const [mesas, reservations] = await Promise.all([
    pool.query<{ count: string }>("SELECT count(*)::text AS count FROM mesa WHERE restaurant_id = $1", [restaurantId]),
    pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM reservation
       WHERE restaurant_id = $1
         AND created_at >= date_trunc('month', now())
         AND status NOT IN ('cancelled', 'no_show')`,
      [restaurantId]
    )
  ]);
  return {
    mesas: Number(mesas.rows[0]?.count ?? 0),
    reservationsThisMonth: Number(reservations.rows[0]?.count ?? 0)
  };
}

export async function getBillingState(restaurantId: string) {
  const subscription = await ensureBillingSubscription(restaurantId);
  const usage = await getBillingUsage(restaurantId);
  return {
    subscription,
    usage,
    plans: Object.values(billingPlans),
    mercadoPagoConfigured: isMercadoPagoConfigured(),
    usable: isBillingUsable(subscription)
  };
}

export async function assertMesaLimit(restaurantId: string) {
  const subscription = await ensureBillingSubscription(restaurantId);
  const usage = await getBillingUsage(restaurantId);
  if (!isBillingUsable(subscription)) {
    return { ok: false as const, reason: "billing_inactive", subscription, usage };
  }
  if (usage.mesas >= subscription.mesa_limit) {
    return { ok: false as const, reason: "mesa_limit", subscription, usage };
  }
  return { ok: true as const, subscription, usage };
}

export async function assertManualReservationLimit(restaurantId: string) {
  const subscription = await ensureBillingSubscription(restaurantId);
  const usage = await getBillingUsage(restaurantId);
  if (!isBillingUsable(subscription)) {
    return { ok: false as const, reason: "billing_inactive", subscription, usage };
  }
  if (usage.reservationsThisMonth >= subscription.monthly_reservation_limit) {
    return { ok: false as const, reason: "reservation_limit", subscription, usage };
  }
  return { ok: true as const, subscription, usage };
}

export async function attachMercadoPagoPreapproval(
  restaurantId: string,
  planKey: PlanKey,
  preapproval: MercadoPagoPreapproval,
  payerEmail: string | null
) {
  const plan = billingPlans[planKey];
  const result = await getPool().query<BillingSubscriptionRow>(
    `UPDATE billing_subscription
     SET plan_key = $2,
         mercadopago_preapproval_id = $3,
         mercadopago_plan_id = $4,
         mercadopago_payer_id = $5,
         mercadopago_payer_email = $6,
         mercadopago_init_point = $7,
         next_payment_at = $8,
         current_period_start = COALESCE(current_period_start, $9),
         monthly_reservation_limit = $10,
         mesa_limit = $11,
         updated_at = now()
     WHERE restaurant_id = $1
     RETURNING *`,
    [
      restaurantId,
      planKey,
      preapproval.id,
      preapproval.preapproval_plan_id ?? null,
      preapproval.payer_id ? String(preapproval.payer_id) : null,
      payerEmail ?? preapproval.payer_email ?? null,
      preapproval.init_point ?? null,
      dateOrNull(preapproval.next_payment_date),
      dateOrNull(preapproval.date_created),
      plan.reservationLimit,
      plan.mesaLimit
    ]
  );
  return result.rows[0] ?? null;
}

export async function upsertMercadoPagoSubscriptionFromObject(preapproval: MercadoPagoPreapproval) {
  const planKey =
    planFromExternalReference(preapproval.external_reference) ??
    planFromMercadoPagoAmount(preapproval.auto_recurring?.transaction_amount) ??
    "growth";
  const restaurantId = restaurantFromExternalReference(preapproval.external_reference);
  const plan = billingPlans[planKey];
  const status = normalizeMercadoPagoStatus(preapproval.status);
  const cancelledAt = status === "canceled" || status === "cancelled" ? new Date() : null;

  const result = await getPool().query<BillingSubscriptionRow>(
    `UPDATE billing_subscription
     SET plan_key = $2,
         status = $3,
         mercadopago_preapproval_id = $4,
         mercadopago_plan_id = $5,
         mercadopago_payer_id = $6,
         mercadopago_payer_email = COALESCE($7, mercadopago_payer_email),
         mercadopago_init_point = COALESCE($8, mercadopago_init_point),
         next_payment_at = $9,
         current_period_start = COALESCE(current_period_start, $10),
         current_period_end = $9,
         cancelled_at = COALESCE($11, cancelled_at),
         monthly_reservation_limit = $12,
         mesa_limit = $13,
         updated_at = now()
     WHERE ${restaurantId ? "restaurant_id = $1" : "mercadopago_preapproval_id = $1"}
     RETURNING *`,
    [
      restaurantId ?? preapproval.id,
      planKey,
      status,
      preapproval.id,
      preapproval.preapproval_plan_id ?? null,
      preapproval.payer_id ? String(preapproval.payer_id) : null,
      preapproval.payer_email ?? null,
      preapproval.init_point ?? null,
      dateOrNull(preapproval.next_payment_date),
      dateOrNull(preapproval.date_created),
      cancelledAt,
      plan.reservationLimit,
      plan.mesaLimit
    ]
  );
  return result.rows[0] ?? null;
}

export async function markMercadoPagoSubscriptionCanceled(restaurantId: string) {
  const result = await getPool().query<BillingSubscriptionRow>(
    `UPDATE billing_subscription
     SET status = 'canceled',
         cancelled_at = now(),
         updated_at = now()
     WHERE restaurant_id = $1
     RETURNING *`,
    [restaurantId]
  );
  return result.rows[0] ?? null;
}

export async function recordMercadoPagoEvent(eventId: string, type: string) {
  const result = await getPool().query<{ id: string }>(
    `INSERT INTO mercadopago_webhook_event (id, type)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`,
    [eventId, type]
  );
  return Boolean(result.rows[0]);
}
