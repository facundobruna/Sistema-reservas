import { createPrivacyRequest } from "@/features/privacy";
import { getRestaurantBySlug } from "@/features/repositories";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { privacyRequestSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, privacyRequestSchema);
    const restaurant = body.restaurantSlug ? await getRestaurantBySlug(body.restaurantSlug) : null;
    if (body.restaurantSlug && !restaurant) return errorResponse("not_found", "Restaurant not found", 404);
    const privacyRequest = await createPrivacyRequest({
      type: body.type,
      restaurantId: restaurant?.id ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      requesterNote: body.note ?? null,
      metadata: { source: "public_form", restaurantSlug: body.restaurantSlug ?? null }
    });

    return json({ ok: true, requestId: privacyRequest.id });
  } catch (error) {
    return handleError(error);
  }
}
