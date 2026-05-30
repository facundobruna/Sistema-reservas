import { DateTime } from "luxon";
import { getDinerSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { reservationPatchSchema } from "@/lib/validation";
import { transitionReservation } from "@/features/reservationStatus";

async function canAccess(request: Request, id: string) {
  const session = await getDinerSession(request);
  if (!session) return false;
  if (session.reservationId === id) return true;
  const result = await getPool().query("SELECT 1 FROM reservation WHERE id = $1 AND customer_id = $2", [
    id,
    session.customerId
  ]);
  return Boolean(result.rowCount);
}

export async function GET(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await context.params;
    if (!(await canAccess(request, id))) return errorResponse("unauthorized", "Missing reservation token", 401);
    const result = await getPool().query(
      `SELECT r.id, r.status, r.starts_at, r.ends_at, r.party_size, r.special_requests,
              rest.name AS restaurant_name, rest.slug, rest.timezone,
              s.name AS service_name, z.name AS zone_name
       FROM reservation r
       JOIN restaurant rest ON rest.id = r.restaurant_id
       LEFT JOIN service s ON s.id = r.service_id
       LEFT JOIN zone z ON z.id = r.zone_id
       WHERE rest.slug = $1 AND r.id = $2`,
      [slug, id]
    );
    const row = result.rows[0];
    if (!row) return errorResponse("not_found", "Reservation not found", 404);
    return json({
      ...row,
      starts_at: DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(row.timezone).toISO(),
      ends_at: DateTime.fromJSDate(row.ends_at, { zone: "utc" }).setZone(row.timezone).toISO()
    });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await context.params;
    if (!(await canAccess(request, id))) return errorResponse("unauthorized", "Missing reservation token", 401);
    const body = await parseJson(request, reservationPatchSchema);
    const result = await transitionReservation({ slug, id, ...body });
    if (result.error) return errorResponse(result.error, result.message, result.status);
    return json(result.reservation);
  } catch (error) {
    return handleError(error);
  }
}
