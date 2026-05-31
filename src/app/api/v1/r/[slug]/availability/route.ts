import { computeAvailability } from "@/features/availability";
import { getRestaurantBySlug, loadAvailabilityContext } from "@/features/repositories";
import { dateSchema, uuidSchema } from "@/lib/validation";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const restaurant = await getRestaurantBySlug(slug);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    if (restaurant.suspendedAt) return errorResponse("restaurant_suspended", "Restaurant booking is temporarily unavailable", 423);

    const url = new URL(request.url);
    const date = dateSchema.parse(url.searchParams.get("date"));
    const partySize = Number(url.searchParams.get("partySize"));
    if (!Number.isInteger(partySize) || partySize < 1) {
      return errorResponse("validation_error", "partySize must be a positive integer", 422);
    }
    const zoneId = url.searchParams.get("zoneId") || null;
    const serviceId = url.searchParams.get("serviceId") || null;
    if (zoneId) uuidSchema.parse(zoneId);
    if (serviceId) uuidSchema.parse(serviceId);

    const contextData = await loadAvailabilityContext(restaurant.id, date, restaurant.timezone);
    const slots = computeAvailability({
      request: { date, partySize, zoneId, serviceId },
      shifts: contextData.shifts,
      units: contextData.units,
      reservations: contextData.reservations,
      timezone: restaurant.timezone,
      exception: contextData.exception
    });

    return json({
      date,
      partySize,
      slots: slots.map((slot) => ({
        time: slot.startsAt.toISO(),
        serviceId: slot.serviceId
      }))
    });
  } catch (error) {
    return handleError(error);
  }
}
