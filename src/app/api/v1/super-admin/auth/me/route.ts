import { requireSuperAdminSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const session = await requireSuperAdminSession(request);
    return json({ superAdmin: session });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    return handleError(error);
  }
}
