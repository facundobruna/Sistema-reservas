import { listSuperAdminTenants, superAdminFeatureFlags } from "@/features/super-admin";
import { requireSuperAdminSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await requireSuperAdminSession(request);
    const search = new URL(request.url).searchParams.get("search") ?? "";
    return json({ tenants: await listSuperAdminTenants(search), featureFlags: superAdminFeatureFlags });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Super-admin session required", 401);
    }
    return handleError(error);
  }
}
