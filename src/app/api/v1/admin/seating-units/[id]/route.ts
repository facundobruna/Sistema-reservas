import { getPool } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { seatingUnitBodySchema, uuidSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const client = await getPool().connect();
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, seatingUnitBodySchema.partial());
    await client.query("BEGIN");
    const updated = await client.query(
      `UPDATE seating_unit
       SET name = COALESCE($3, name),
           min_capacity = COALESCE($4, min_capacity),
           max_capacity = COALESCE($5, max_capacity),
           active = COALESCE($6, active)
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [id, session.restaurantId, body.name ?? null, body.minCapacity ?? null, body.maxCapacity ?? null, body.active ?? null]
    );
    if (!updated.rows[0]) {
      await client.query("ROLLBACK");
      return errorResponse("not_found", "Seating unit not found", 404);
    }
    if (body.mesaIds?.length) {
      await client.query("DELETE FROM seating_unit_mesa WHERE seating_unit_id = $1", [id]);
      for (const mesaId of body.mesaIds) {
        await client.query(
          `INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id)
           SELECT $1, id FROM mesa WHERE id = $2 AND restaurant_id = $3`,
          [id, mesaId, session.restaurantId]
        );
      }
    }
    await client.query("COMMIT");
    return json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const result = await getPool().query(
      "DELETE FROM seating_unit WHERE id = $1 AND restaurant_id = $2 RETURNING id",
      [id, session.restaurantId]
    );
    if (!result.rows[0]) return errorResponse("not_found", "Seating unit not found", 404);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
