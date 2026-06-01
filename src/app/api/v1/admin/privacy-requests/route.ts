import { listPrivacyRequests } from "@/features/privacy";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    return json({ requests: await listPrivacyRequests(session.restaurantId) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Staff session required", 401);
    }
    return handleError(error);
  }
}
