import { DateTime } from "luxon";
import { getDinerSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await getDinerSession(request);
    if (!session) return errorResponse("unauthorized", "Missing diner session", 401);
    const result = await getPool().query(
      `SELECT r.id, r.status, r.starts_at, r.ends_at, r.party_size,
              rest.name AS restaurant_name, rest.slug, rest.timezone
       FROM reservation r
       JOIN restaurant rest ON rest.id = r.restaurant_id
       WHERE r.customer_id = $1
       ORDER BY r.starts_at DESC`,
      [session.customerId]
    );
    return json({
      reservations: result.rows.map((row) => ({
        ...row,
        starts_at: DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(row.timezone).toISO(),
        ends_at: DateTime.fromJSDate(row.ends_at, { zone: "utc" }).setZone(row.timezone).toISO()
      }))
    });
  } catch (error) {
    return handleError(error);
  }
}
