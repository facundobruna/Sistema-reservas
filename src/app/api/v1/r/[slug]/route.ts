import { getPublicRestaurant } from "@/features/repositories";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const restaurant = await getPublicRestaurant(slug);
    if (!restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    const settings = restaurant.settings;
    return json({
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      timezone: restaurant.timezone,
      zones: restaurant.zones,
      services: restaurant.services,
      branding: (settings.branding as Record<string, unknown> | undefined) ?? {},
      bookingWindow: (settings.bookingWindow as Record<string, unknown> | undefined) ?? {
        maxDaysAhead: 45,
        minHoursBefore: 2
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
