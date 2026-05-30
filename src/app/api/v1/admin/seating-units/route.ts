import { createSeatingUnitCombo } from "@/features/repositories";
import { getPool } from "@/lib/db";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson, created } from "@/lib/http";
import { seatingUnitBodySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const result = await getPool().query(
      `SELECT su.*, COALESCE(array_agg(sum.mesa_id) FILTER (WHERE sum.mesa_id IS NOT NULL), '{}') AS mesa_ids
       FROM seating_unit su
       LEFT JOIN seating_unit_mesa sum ON sum.seating_unit_id = su.id
       WHERE su.restaurant_id = $1
       GROUP BY su.id
       ORDER BY su.kind, su.max_capacity, su.name`,
      [session.restaurantId]
    );
    return json({ seatingUnits: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, seatingUnitBodySchema);
    if (body.kind === "single") {
      return errorResponse("invalid_kind", "Single seating units are created by mesas", 422);
    }
    return created(await createSeatingUnitCombo({ restaurantId: session.restaurantId, ...body }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
