import { getPool } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { mesaBodySchema, uuidSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, mesaBodySchema.partial());
    const result = await getPool().query(
      `UPDATE mesa
       SET zone_id = COALESCE($3::uuid, zone_id),
           name = COALESCE($4, name),
           min_capacity = COALESCE($5, min_capacity),
           max_capacity = COALESCE($6, max_capacity),
           active = COALESCE($7, active)
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [
        id,
        session.restaurantId,
        body.zoneId ?? null,
        body.name ?? null,
        body.minCapacity ?? null,
        body.maxCapacity ?? null,
        body.active ?? null
      ]
    );
    if (!result.rows[0]) return errorResponse("not_found", "Mesa not found", 404);
    return json(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM seating_unit
       WHERE kind = 'single'
         AND restaurant_id = $2
         AND id IN (SELECT seating_unit_id FROM seating_unit_mesa WHERE mesa_id = $1)`,
      [id, session.restaurantId]
    );
    const deleted = await client.query("DELETE FROM mesa WHERE id = $1 AND restaurant_id = $2 RETURNING id", [
      id,
      session.restaurantId
    ]);
    await client.query("COMMIT");
    if (!deleted.rows[0]) return errorResponse("not_found", "Mesa not found", 404);
    return json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  } finally {
    client.release();
  }
}
