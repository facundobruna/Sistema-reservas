import { DateTime } from "luxon";
import { createReservation } from "@/features/booking";
import { getRestaurantById } from "@/features/repositories";
import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { created, errorResponse, handleError, json, parseJson } from "@/lib/http";
import { adminReservationSchema, dateSchema, uuidSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const restaurant = await getRestaurantById(session.restaurantId);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    const url = new URL(request.url);
    const date = dateSchema.parse(url.searchParams.get("date") ?? DateTime.now().setZone(restaurant.timezone).toISODate());
    const status = url.searchParams.get("status");
    const zoneId = url.searchParams.get("zoneId");
    if (zoneId) uuidSchema.parse(zoneId);
    const start = DateTime.fromISO(date, { zone: restaurant.timezone }).startOf("day").toUTC().toISO();
    const end = DateTime.fromISO(date, { zone: restaurant.timezone }).plus({ days: 1 }).startOf("day").toUTC().toISO();

    const result = await getPool().query(
      `SELECT r.*, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              s.name AS service_name, z.name AS zone_name, su.name AS seating_unit_name
       FROM reservation r
       JOIN customer c ON c.id = r.customer_id
       LEFT JOIN service s ON s.id = r.service_id
       LEFT JOIN zone z ON z.id = r.zone_id
       LEFT JOIN seating_unit su ON su.id = r.seating_unit_id
       WHERE r.restaurant_id = $1
         AND r.starts_at >= $2::timestamptz
         AND r.starts_at < $3::timestamptz
         AND ($4::reservation_status IS NULL OR r.status = $4::reservation_status)
         AND ($5::uuid IS NULL OR r.zone_id = $5::uuid)
       ORDER BY r.starts_at`,
      [session.restaurantId, start, end, status || null, zoneId || null]
    );

    return json({ reservations: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const restaurant = await getRestaurantById(session.restaurantId);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    const body = await parseJson(request, adminReservationSchema);
    const result = await createReservation({ ...body, slug: restaurant.slug, source: "manual" });
    if (!result.ok) return errorResponse("slot_unavailable", "The selected slot is no longer available", 409);
    return created(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
