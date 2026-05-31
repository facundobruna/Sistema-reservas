import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { uuidSchema, waitlistPatchSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id: rawId } = await context.params;
    const id = uuidSchema.parse(rawId);
    const body = await parseJson(request, waitlistPatchSchema);
    const result = await getPool().query(
      `UPDATE waitlist_entry
       SET status = $3, updated_at = now()
       WHERE id = $1 AND restaurant_id = $2
       RETURNING *`,
      [id, session.restaurantId, body.status]
    );
    const entry = result.rows[0];
    if (!entry) return errorResponse("not_found", "Waitlist entry not found", 404);
    return json({ entry });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
