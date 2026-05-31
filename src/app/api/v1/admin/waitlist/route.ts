import { DateTime } from "luxon";
import { getRestaurantById } from "@/features/repositories";
import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { dateSchema } from "@/lib/validation";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const restaurant = await getRestaurantById(session.restaurantId);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);

    const url = new URL(request.url);
    const date = dateSchema.parse(url.searchParams.get("date") ?? DateTime.now().setZone(restaurant.timezone).toISODate());

    const result = await getPool().query(
      `SELECT w.id, w.status, w.date::text, w.party_size, w.preferred_time::text,
              w.special_requests, w.created_at,
              c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email,
              s.name AS service_name, z.name AS zone_name
       FROM waitlist_entry w
       JOIN customer c ON c.id = w.customer_id
       LEFT JOIN service s ON s.id = w.service_id
       LEFT JOIN zone z ON z.id = w.zone_id
       WHERE w.restaurant_id = $1 AND w.date = $2::date
       ORDER BY CASE w.status
                  WHEN 'open' THEN 0
                  WHEN 'notified' THEN 1
                  WHEN 'booked' THEN 2
                  ELSE 3
                END,
                w.created_at`,
      [session.restaurantId, date]
    );

    return json({ entries: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
