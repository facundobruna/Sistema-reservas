import { insertRow, listRows } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { created, errorResponse, handleError, json, parseJson } from "@/lib/http";
import { exceptionBodySchema } from "@/lib/validation";

const casts = { date: "date", start_time: "time", end_time: "time" };

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    return json({ exceptions: await listRows("schedule_exception", session.restaurantId, "date DESC") });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, exceptionBodySchema);
    return created(
      await insertRow(
        "schedule_exception",
        session.restaurantId,
        {
          date: body.date,
          kind: body.kind,
          start_time: body.startTime ?? null,
          end_time: body.endTime ?? null,
          note: body.note ?? null
        },
        casts
      )
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
