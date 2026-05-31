import { joinWaitlist } from "@/features/waitlist";
import { setDinerCookie } from "@/lib/auth";
import { created, errorResponse, handleError, parseJson } from "@/lib/http";
import { waitlistEntrySchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const body = await parseJson(request, waitlistEntrySchema);
    const result = await joinWaitlist({ ...body, slug });

    if (!result.ok) {
      if (result.error === "restaurant_not_found") return errorResponse("not_found", "Restaurant not found", 404);
      if (result.error === "restaurant_suspended") {
        return errorResponse("restaurant_suspended", "Restaurant booking is temporarily unavailable", 423);
      }
      if (result.error === "past_date") return errorResponse("past_date", "Choose today or a future date", 422);
      return errorResponse("invalid_scope", "Selected area or service does not belong to this restaurant", 422);
    }

    await setDinerCookie(result.dinerToken);
    return created(result);
  } catch (error) {
    return handleError(error);
  }
}
