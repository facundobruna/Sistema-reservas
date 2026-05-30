import { deleteRow, updateRow } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { shiftBodySchema, uuidSchema } from "@/lib/validation";

const casts = { service_id: "uuid", zone_id: "uuid", start_time: "time", end_time: "time", fixed_times: "time[]" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, shiftBodySchema.partial());
    const row = await updateRow(
      "shift",
      session.restaurantId,
      id,
      {
        service_id: body.serviceId,
        zone_id: body.zoneId,
        day_of_week: body.dayOfWeek,
        start_time: body.startTime,
        end_time: body.endTime,
        slot_interval_min: body.slotIntervalMin,
        turn_duration_min: body.turnDurationMin,
        seating_mode: body.seatingMode,
        fixed_times: body.fixedTimes,
        pacing_cap: body.pacingCap
      },
      casts
    );
    if (!row) return errorResponse("not_found", "Shift not found", 404);
    return json(row);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const row = await deleteRow("shift", session.restaurantId, id);
    if (!row) return errorResponse("not_found", "Shift not found", 404);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
