import { getPool } from "@/lib/db";
import type { StaffSession } from "@/lib/auth";

export type StaffAuditLog = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  staffName: string | null;
  staffEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function recordStaffAudit(input: {
  session: StaffSession;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await getPool().query(
    `INSERT INTO staff_audit_log (restaurant_id, staff_user_id, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      input.session.restaurantId,
      input.session.staffId,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function listStaffAuditLogs(restaurantId: string, limit = 40): Promise<StaffAuditLog[]> {
  const result = await getPool().query<{
    id: string;
    action: string;
    target_type: string | null;
    target_id: string | null;
    staff_name: string | null;
    staff_email: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
  }>(
    `SELECT sal.id,
            sal.action,
            sal.target_type,
            sal.target_id,
            su.name AS staff_name,
            su.email::text AS staff_email,
            sal.metadata,
            sal.created_at::text
     FROM staff_audit_log sal
     LEFT JOIN staff_user su ON su.id = sal.staff_user_id
     WHERE sal.restaurant_id = $1
     ORDER BY sal.created_at DESC
     LIMIT $2`,
    [restaurantId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    staffName: row.staff_name,
    staffEmail: row.staff_email,
    metadata: row.metadata,
    createdAt: row.created_at
  }));
}
