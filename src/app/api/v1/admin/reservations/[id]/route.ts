import { transitionReservation } from "@/features/reservationStatus";
import { recordStaffAudit } from "@/features/staffAudit";
import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { reservationPatchSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const result = await getPool().query(
      `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              s.name AS service_name, z.name AS zone_name, su.name AS seating_unit_name
       FROM reservation r
       JOIN customer c ON c.id = r.customer_id
       LEFT JOIN service s ON s.id = r.service_id
       LEFT JOIN zone z ON z.id = r.zone_id
       LEFT JOIN seating_unit su ON su.id = r.seating_unit_id
       WHERE r.restaurant_id = $1 AND r.id = $2`,
      [session.restaurantId, id]
    );
    if (!result.rows[0]) return errorResponse("not_found", "Reservation not found", 404);
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
    const body = await parseJson(request, reservationPatchSchema);
    const result = await transitionReservation({ restaurantId: session.restaurantId, id, ...body });
    if (result.error) return errorResponse(result.error, result.message, result.status);
    await recordStaffAudit({
      session,
      action: "reservation.update",
      targetType: "reservation",
      targetId: id,
      metadata: body
    });
    return json(result.reservation);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
