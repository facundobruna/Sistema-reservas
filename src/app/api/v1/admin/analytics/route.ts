import { getRestaurantAnalytics, resolveAnalyticsRange } from "@/features/analytics";
import { getRestaurantById } from "@/features/repositories";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const restaurant = await getRestaurantById(session.restaurantId);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);

    const url = new URL(request.url);
    const range = resolveAnalyticsRange({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      timezone: restaurant.timezone
    });

    return json(await getRestaurantAnalytics(session.restaurantId, range));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Staff session required", 401);
    }
    return handleError(error);
  }
}
