import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { reservationPatchSchema } from "@/lib/validation";
import { canAccessDinerReservation, getDinerReservation } from "@/features/dinerReservations";
import { transitionReservation } from "@/features/reservationStatus";

export async function GET(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await context.params;
    if (!(await canAccessDinerReservation(request, id))) return errorResponse("unauthorized", "Missing reservation token", 401);
    const reservation = await getDinerReservation(slug, id);
    if (!reservation) return errorResponse("not_found", "Reservation not found", 404);
    return json(reservation);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await context.params;
    if (!(await canAccessDinerReservation(request, id))) return errorResponse("unauthorized", "Missing reservation token", 401);
    const body = await parseJson(request, reservationPatchSchema);
    const result = await transitionReservation({ slug, id, ...body });
    if (result.error) return errorResponse(result.error, result.message, result.status);
    return json(result.reservation);
  } catch (error) {
    return handleError(error);
  }
}
