import { deleteRow, updateRow } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { uuidSchema, zoneBodySchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, zoneBodySchema.partial());
    const row = await updateRow("zone", session.restaurantId, id, { name: body.name, position: body.position });
    if (!row) return errorResponse("not_found", "Zone not found", 404);
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
    const row = await deleteRow("zone", session.restaurantId, id);
    if (!row) return errorResponse("not_found", "Zone not found", 404);
    return json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
