import { insertRow, listRows } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { created, errorResponse, handleError, json, parseJson } from "@/lib/http";
import { shiftBodySchema } from "@/lib/validation";

const casts = { service_id: "uuid", zone_id: "uuid", start_time: "time", end_time: "time", fixed_times: "time[]" };

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    return json({ shifts: await listRows("shift", session.restaurantId, "day_of_week, start_time") });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, shiftBodySchema);
    const row = await insertRow(
      "shift",
      session.restaurantId,
      {
        service_id: body.serviceId,
        zone_id: body.zoneId ?? null,
        day_of_week: body.dayOfWeek,
        start_time: body.startTime,
        end_time: body.endTime,
        slot_interval_min: body.slotIntervalMin,
        turn_duration_min: body.turnDurationMin,
        seating_mode: body.seatingMode,
        fixed_times: body.fixedTimes ?? null,
        pacing_cap: body.pacingCap ?? null
      },
      casts
    );
    return created(row);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
