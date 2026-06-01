import { getRestaurantById, updateRestaurantSettings } from "@/features/repositories";
import { recordStaffAudit } from "@/features/staffAudit";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { settingsBodySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const restaurant = await getRestaurantById(session.restaurantId);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    return json(restaurant);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, settingsBodySchema);
    const restaurant = await updateRestaurantSettings(session.restaurantId, body);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    await recordStaffAudit({
      session,
      action: "settings.update",
      targetType: "restaurant",
      targetId: session.restaurantId,
      metadata: { changedKeys: Object.keys(body) }
    });
    return json(restaurant);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
