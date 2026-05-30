import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const search = new URL(request.url).searchParams.get("search") ?? "";
    const result = await getPool().query(
      `SELECT c.id, c.name, c.email, c.phone, cr.notes, cr.tags, cr.no_show_count, cr.visit_count, cr.vip
       FROM customer_restaurant cr
       JOIN customer c ON c.id = cr.customer_id
       WHERE cr.restaurant_id = $1
         AND ($2 = '' OR c.name ILIKE '%' || $2 || '%' OR c.phone ILIKE '%' || $2 || '%' OR c.email::text ILIKE '%' || $2 || '%')
       ORDER BY cr.vip DESC, c.name NULLS LAST, c.phone
       LIMIT 50`,
      [session.restaurantId, search]
    );
    return json({ customers: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
