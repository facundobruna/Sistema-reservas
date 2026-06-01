import { anonymizeCustomerData, createPrivacyRequest } from "@/features/privacy";
import { getDinerSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { dinerDeletionSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const session = await getDinerSession(request);
    if (!session) return errorResponse("unauthorized", "Missing diner session", 401);
    await parseJson(request, dinerDeletionSchema);

    const privacyRequest = await createPrivacyRequest({
      type: "delete",
      customerId: session.customerId,
      status: "completed",
      metadata: { source: "diner_self_service" }
    });
    const deletion = await anonymizeCustomerData({
      customerId: session.customerId,
      requestId: privacyRequest.id
    });
    if (!deletion.ok) return errorResponse("not_found", "Customer not found", 404);

    return json({
      ok: true,
      requestId: privacyRequest.id,
      cancelledFutureReservations: deletion.cancelledFutureReservations
    });
  } catch (error) {
    return handleError(error);
  }
}
