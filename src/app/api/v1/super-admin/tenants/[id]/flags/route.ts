import { z } from "zod";
import { updateTenantFeatureFlag } from "@/features/super-admin";
import { requireSuperAdminSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

const flagSchema = z.object({
  key: z.string().min(1).max(80),
  enabled: z.boolean()
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdminSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, flagSchema);
    const flag = await updateTenantFeatureFlag({ restaurantId: id, key: body.key, enabled: body.enabled, session });
    return json({ flag });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    if (error instanceof Error && error.message === "Unknown feature flag") {
      return errorResponse("unknown_feature_flag", "Unknown feature flag", 422);
    }
    return handleError(error);
  }
}
