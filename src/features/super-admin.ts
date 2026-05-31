import { billingPlans, type PlanKey } from "@/features/billing";
import { getPool } from "@/lib/db";
import type { SuperAdminSession } from "@/lib/auth";

export const superAdminFeatureFlags = [
  { key: "waitlist", label: "Waitlist" },
  { key: "whatsapp_beta", label: "WhatsApp beta" },
  { key: "overbooking", label: "Overbooking" },
  { key: "advanced_analytics", label: "Analytics avanzado" }
] as const;

type BillingStatus = "trialing" | "pending" | "authorized" | "active" | "paused" | "canceled" | "cancelled" | "inactive" | "finished" | "expired";

export type SuperAdminTenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  planKey: PlanKey;
  billingStatus: BillingStatus;
  reservations30: number;
  covers30: number;
  totalReservations: number;
  mesas: number;
  staffUsers: number;
  lastReservationAt: string | null;
  flags: Record<string, boolean>;
  mrrAmount: number;
};

export type SuperAdminOverview = {
  totals: {
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    mrrAmount: number;
    signups30: number;
    churn30: number;
    reservations30: number;
    covers30: number;
  };
  planMix: Array<{ label: string; value: number; mrrAmount: number }>;
  statusMix: Array<{ label: string; value: number }>;
  recentSignups: Array<{ date: string; tenants: number }>;
  recentAudit: SuperAdminAuditLog[];
};

export type SuperAdminAuditLog = {
  id: string;
  action: string;
  restaurantId: string | null;
  restaurantName: string | null;
  adminEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

function normalizePlan(planKey: string | null | undefined): PlanKey {
  return planKey === "starter" || planKey === "scale" ? planKey : "growth";
}

function normalizeBillingStatus(status: string | null | undefined): BillingStatus {
  if (
    status === "trialing" ||
    status === "pending" ||
    status === "authorized" ||
    status === "active" ||
    status === "paused" ||
    status === "canceled" ||
    status === "cancelled" ||
    status === "inactive" ||
    status === "finished" ||
    status === "expired"
  ) {
    return status;
  }
  return "trialing";
}

function amountFor(planKey: PlanKey, status: BillingStatus) {
  return status === "active" || status === "authorized" ? billingPlans[planKey].amount : 0;
}

function flagsFrom(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, boolean>) : {};
}

export async function listSuperAdminTenants(search = ""): Promise<SuperAdminTenant[]> {
  const result = await getPool().query<{
    id: string;
    slug: string;
    name: string;
    timezone: string;
    created_at: string;
    suspended_at: string | null;
    suspended_reason: string | null;
    plan_key: string | null;
    billing_status: string | null;
    reservations_30: string;
    covers_30: string;
    total_reservations: string;
    mesas: string;
    staff_users: string;
    last_reservation_at: string | null;
    flags: Record<string, boolean>;
  }>(
    `SELECT r.id,
            r.slug,
            r.name,
            r.timezone,
            r.created_at::text,
            r.suspended_at::text,
            r.suspended_reason,
            bs.plan_key,
            bs.status AS billing_status,
            (
              SELECT count(*)::text
              FROM reservation res
              WHERE res.restaurant_id = r.id
                AND res.starts_at >= now() - interval '30 days'
            ) AS reservations_30,
            (
              SELECT COALESCE(sum(res.party_size), 0)::text
              FROM reservation res
              WHERE res.restaurant_id = r.id
                AND res.starts_at >= now() - interval '30 days'
                AND res.status NOT IN ('cancelled', 'no_show')
            ) AS covers_30,
            (
              SELECT count(*)::text
              FROM reservation res
              WHERE res.restaurant_id = r.id
            ) AS total_reservations,
            (
              SELECT count(*)::text
              FROM mesa m
              WHERE m.restaurant_id = r.id
            ) AS mesas,
            (
              SELECT count(*)::text
              FROM staff_user su
              WHERE su.restaurant_id = r.id
            ) AS staff_users,
            (
              SELECT max(res.starts_at)::text
              FROM reservation res
              WHERE res.restaurant_id = r.id
            ) AS last_reservation_at,
            COALESCE(
              (
                SELECT jsonb_object_agg(rff.key, rff.enabled)
                FROM restaurant_feature_flag rff
                WHERE rff.restaurant_id = r.id
              ),
              '{}'::jsonb
            ) AS flags
     FROM restaurant r
     LEFT JOIN billing_subscription bs ON bs.restaurant_id = r.id
     WHERE $1 = ''
        OR r.name ILIKE '%' || $1 || '%'
        OR r.slug ILIKE '%' || $1 || '%'
     ORDER BY r.created_at DESC`,
    [search]
  );

  return result.rows.map((row) => {
    const planKey = normalizePlan(row.plan_key);
    const billingStatus = normalizeBillingStatus(row.billing_status);
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      timezone: row.timezone,
      createdAt: row.created_at,
      suspendedAt: row.suspended_at,
      suspendedReason: row.suspended_reason,
      planKey,
      billingStatus,
      reservations30: Number(row.reservations_30),
      covers30: Number(row.covers_30),
      totalReservations: Number(row.total_reservations),
      mesas: Number(row.mesas),
      staffUsers: Number(row.staff_users),
      lastReservationAt: row.last_reservation_at,
      flags: flagsFrom(row.flags),
      mrrAmount: amountFor(planKey, billingStatus)
    };
  });
}

export async function getSuperAdminOverview(): Promise<SuperAdminOverview> {
  const [tenants, signups, recentAudit] = await Promise.all([
    listSuperAdminTenants(),
    getPool().query<{ date: string; tenants: number }>(
      `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS date,
              count(*)::int AS tenants
       FROM restaurant
       WHERE created_at >= now() - interval '30 days'
       GROUP BY 1
       ORDER BY 1`
    ),
    listSuperAdminAuditLogs(6)
  ]);

  const planMix = new Map<string, { label: string; value: number; mrrAmount: number }>();
  const statusMix = new Map<string, { label: string; value: number }>();
  for (const tenant of tenants) {
    const plan = planMix.get(tenant.planKey) ?? { label: tenant.planKey, value: 0, mrrAmount: 0 };
    plan.value += 1;
    plan.mrrAmount += tenant.mrrAmount;
    planMix.set(tenant.planKey, plan);

    const status = statusMix.get(tenant.billingStatus) ?? { label: tenant.billingStatus, value: 0 };
    status.value += 1;
    statusMix.set(tenant.billingStatus, status);
  }

  const suspended30 = tenants.filter((tenant) => tenant.suspendedAt && Date.now() - new Date(tenant.suspendedAt).getTime() <= 30 * 24 * 60 * 60 * 1000).length;
  const canceled30 = tenants.filter((tenant) => tenant.billingStatus === "canceled" || tenant.billingStatus === "cancelled").length;

  return {
    totals: {
      tenants: tenants.length,
      activeTenants: tenants.filter((tenant) => !tenant.suspendedAt).length,
      suspendedTenants: tenants.filter((tenant) => tenant.suspendedAt).length,
      mrrAmount: tenants.reduce((sum, tenant) => sum + tenant.mrrAmount, 0),
      signups30: signups.rows.reduce((sum, row) => sum + Number(row.tenants), 0),
      churn30: suspended30 + canceled30,
      reservations30: tenants.reduce((sum, tenant) => sum + tenant.reservations30, 0),
      covers30: tenants.reduce((sum, tenant) => sum + tenant.covers30, 0)
    },
    planMix: Array.from(planMix.values()),
    statusMix: Array.from(statusMix.values()),
    recentSignups: signups.rows,
    recentAudit
  };
}

export async function updateTenantSuspension(input: {
  restaurantId: string;
  suspended: boolean;
  reason?: string | null;
  session: SuperAdminSession;
}) {
  const result = await getPool().query<{ id: string; name: string; suspended_at: string | null }>(
    `UPDATE restaurant
     SET suspended_at = CASE WHEN $2 THEN now() ELSE NULL END,
         suspended_reason = CASE WHEN $2 THEN NULLIF($3, '') ELSE NULL END,
         updated_at = now()
     WHERE id = $1
     RETURNING id, name, suspended_at::text`,
    [input.restaurantId, input.suspended, input.reason ?? null]
  );
  const tenant = result.rows[0] ?? null;
  if (tenant) {
    await recordSuperAdminAudit({
      session: input.session,
      action: input.suspended ? "tenant.suspend" : "tenant.reactivate",
      restaurantId: input.restaurantId,
      metadata: { reason: input.reason ?? null }
    });
  }
  return tenant;
}

export async function updateTenantFeatureFlag(input: {
  restaurantId: string;
  key: string;
  enabled: boolean;
  session: SuperAdminSession;
}) {
  if (!superAdminFeatureFlags.some((flag) => flag.key === input.key)) {
    throw new Error("Unknown feature flag");
  }

  const result = await getPool().query(
    `INSERT INTO restaurant_feature_flag (restaurant_id, key, enabled, updated_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (restaurant_id, key)
     DO UPDATE SET enabled = EXCLUDED.enabled,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = now()
     RETURNING restaurant_id, key, enabled`,
    [input.restaurantId, input.key, input.enabled, input.session.superAdminId]
  );

  await recordSuperAdminAudit({
    session: input.session,
    action: "feature_flag.update",
    restaurantId: input.restaurantId,
    metadata: { key: input.key, enabled: input.enabled }
  });

  return result.rows[0] ?? null;
}

export async function getImpersonationTarget(restaurantId: string) {
  const result = await getPool().query<{
    staff_id: string;
    restaurant_id: string;
    slug: string;
    role: "owner" | "manager" | "host";
  }>(
    `SELECT su.id AS staff_id,
            r.id AS restaurant_id,
            r.slug,
            su.role
     FROM restaurant r
     JOIN staff_user su ON su.restaurant_id = r.id
     WHERE r.id = $1
     ORDER BY CASE su.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END,
              su.created_at
     LIMIT 1`,
    [restaurantId]
  );
  return result.rows[0] ?? null;
}

export async function recordSuperAdminAudit(input: {
  session: SuperAdminSession;
  action: string;
  restaurantId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await getPool().query(
    `INSERT INTO super_admin_audit_log (super_admin_id, action, restaurant_id, metadata)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [input.session.superAdminId, input.action, input.restaurantId ?? null, JSON.stringify(input.metadata ?? {})]
  );
}

export async function listSuperAdminAuditLogs(limit = 30): Promise<SuperAdminAuditLog[]> {
  const result = await getPool().query<{
    id: string;
    action: string;
    restaurant_id: string | null;
    restaurant_name: string | null;
    admin_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT al.id,
            al.action,
            al.restaurant_id,
            r.name AS restaurant_name,
            sau.email::text AS admin_email,
            al.metadata,
            al.created_at::text
     FROM super_admin_audit_log al
     LEFT JOIN restaurant r ON r.id = al.restaurant_id
     LEFT JOIN super_admin_user sau ON sau.id = al.super_admin_id
     ORDER BY al.created_at DESC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    restaurantId: row.restaurant_id,
    restaurantName: row.restaurant_name,
    adminEmail: row.admin_email,
    metadata: row.metadata,
    createdAt: row.created_at
  }));
}
