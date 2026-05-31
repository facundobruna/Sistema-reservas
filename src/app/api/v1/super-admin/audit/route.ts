import { listSuperAdminAuditLogs } from "@/features/super-admin";
import { requireSuperAdminSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireSuperAdminSession(request);
    return json({ audit: await listSuperAdminAuditLogs(40) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    return handleError(error);
  }
}
