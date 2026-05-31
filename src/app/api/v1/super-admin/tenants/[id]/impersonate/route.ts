import { getImpersonationTarget, recordSuperAdminAudit } from "@/features/super-admin";
import { createStaffToken, requireSuperAdminSession, setStaffCookie } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";
import { uuidSchema } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdminSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const target = await getImpersonationTarget(id);
    if (!target) return errorResponse("impersonation_target_missing", "Restaurant has no staff user to impersonate", 409);

    const token = createStaffToken({
      type: "staff",
      staffId: target.staff_id,
      restaurantId: target.restaurant_id,
      role: target.role
    });
    await setStaffCookie(token);
    await recordSuperAdminAudit({
      session,
      action: "tenant.impersonate",
      restaurantId: target.restaurant_id,
      metadata: { staffId: target.staff_id, role: target.role }
    });
    return json({ url: `/admin?impersonated=${target.slug}`, token });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    return handleError(error);
  }
}
