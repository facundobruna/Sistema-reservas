import { buildReservationIcs, canAccessDinerReservation, getDinerReservation } from "@/features/dinerReservations";
import { errorResponse, handleError } from "@/lib/http";

export async function GET(request: Request, context: { params: Promise<{ slug: string; id: string }> }) {
  try {
    const { slug, id } = await context.params;
    if (!(await canAccessDinerReservation(request, id))) return errorResponse("unauthorized", "Missing reservation token", 401);

    const reservation = await getDinerReservation(slug, id);
    if (!reservation) return errorResponse("not_found", "Reservation not found", 404);

    return new Response(buildReservationIcs(reservation), {
      headers: {
        "content-disposition": `attachment; filename="mesa-clara-${reservation.id}.ics"`,
        "content-type": "text/calendar; charset=utf-8"
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
