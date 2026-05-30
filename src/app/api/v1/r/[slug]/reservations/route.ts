import { createReservation } from "@/features/booking";
import { created, errorResponse, handleError, parseJson } from "@/lib/http";
import { publicReservationSchema } from "@/lib/validation";
import { setDinerCookie } from "@/lib/auth";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = await parseJson(request, publicReservationSchema);
    const result = await createReservation({ ...body, slug, source: "web" });
    if (!result.ok) {
      return result.error === "restaurant_not_found"
        ? errorResponse("not_found", "Restaurant not found", 404)
        : errorResponse("slot_unavailable", "The selected slot is no longer available", 409);
    }
    await setDinerCookie(result.dinerToken);
    return created(result);
  } catch (error) {
    return handleError(error);
  }
}
