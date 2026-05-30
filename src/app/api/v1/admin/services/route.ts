import { listRows, insertRow } from "@/features/adminResources";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson, created } from "@/lib/http";
import { serviceBodySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    return json({ services: await listRows("service", session.restaurantId, "position, name") });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, serviceBodySchema);
    return created(await insertRow("service", session.restaurantId, { name: body.name, position: body.position }));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
