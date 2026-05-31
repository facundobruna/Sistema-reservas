import { z } from "zod";
import { updateTenantSuspension } from "@/features/super-admin";
import { requireSuperAdminSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const tenantPatchSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(300).optional().nullable()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdminSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, tenantPatchSchema);
    const tenant = await updateTenantSuspension({
      restaurantId: id,
      suspended: body.suspended,
      reason: body.reason,
      session
    });
    if (!tenant) return errorResponse("not_found", "Restaurant not found", 404);
    return json({ tenant });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    return handleError(error);
  }
}
