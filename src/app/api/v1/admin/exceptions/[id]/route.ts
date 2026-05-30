import { deleteRow, updateRow } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { exceptionBodySchema, uuidSchema } from "@/lib/validation";

const casts = { date: "date", start_time: "time", end_time: "time" };

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, exceptionBodySchema.partial());
    const row = await updateRow(
      "schedule_exception",
      session.restaurantId,
      id,
      {
        date: body.date,
        kind: body.kind,
        start_time: body.startTime,
        end_time: body.endTime,
        note: body.note
      },
      casts
    );
    if (!row) return errorResponse("not_found", "Exception not found", 404);
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
    const row = await deleteRow("schedule_exception", session.restaurantId, id);
    if (!row) return errorResponse("not_found", "Exception not found", 404);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
