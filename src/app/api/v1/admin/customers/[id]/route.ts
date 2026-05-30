import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { customerPatchSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const result = await getPool().query(
      `SELECT c.id, c.name, c.email, c.phone, c.created_at,
              cr.notes, cr.tags, cr.no_show_count, cr.visit_count, cr.vip,
              COALESCE(json_agg(r ORDER BY r.starts_at DESC) FILTER (WHERE r.id IS NOT NULL), '[]') AS reservations
       FROM customer_restaurant cr
       JOIN customer c ON c.id = cr.customer_id
       LEFT JOIN reservation r ON r.customer_id = c.id AND r.restaurant_id = cr.restaurant_id
       WHERE cr.restaurant_id = $1 AND c.id = $2
       GROUP BY c.id, cr.restaurant_id, cr.customer_id, cr.notes, cr.tags, cr.no_show_count, cr.visit_count, cr.vip`,
      [session.restaurantId, id]
    );
    if (!result.rows[0]) return errorResponse("not_found", "Customer not found", 404);
    return json(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, customerPatchSchema);
    const result = await getPool().query(
      `UPDATE customer_restaurant
       SET notes = COALESCE($3, notes),
           tags = COALESCE($4::text[], tags),
           vip = COALESCE($5, vip)
       WHERE restaurant_id = $1 AND customer_id = $2
       RETURNING *`,
      [session.restaurantId, id, body.notes ?? null, body.tags ?? null, body.vip ?? null]
    );
    if (!result.rows[0]) return errorResponse("not_found", "Customer not found", 404);
    return json(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
