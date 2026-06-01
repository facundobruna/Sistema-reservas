import { updatePrivacyRequestStatus } from "@/features/privacy";
import { recordStaffAudit } from "@/features/staffAudit";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { privacyRequestPatchSchema, uuidSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireStaffSession(request);
    const { id } = await context.params;
    uuidSchema.parse(id);
    const body = await parseJson(request, privacyRequestPatchSchema);
    const privacyRequest = await updatePrivacyRequestStatus({
      restaurantId: session.restaurantId,
      requestId: id,
      status: body.status,
      handledBy: session.staffId
    });
    if (!privacyRequest) return errorResponse("not_found", "Privacy request not found", 404);

    await recordStaffAudit({
      session,
      action: "privacy_request.update",
      targetType: "privacy_request",
      targetId: id,
      metadata: { status: body.status, type: privacyRequest.type }
    });

    return json(privacyRequest);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Staff session required", 401);
    }
    return handleError(error);
  }
}
