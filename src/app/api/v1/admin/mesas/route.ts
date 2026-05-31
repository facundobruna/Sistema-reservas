import { listRows } from "@/features/adminResources";
import { assertMesaLimit } from "@/features/billing";
import { createMesaWithSeatingUnit } from "@/features/repositories";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson, created } from "@/lib/http";
import { mesaBodySchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    const session = await requireStaffSession(request);
    return json({ mesas: await listRows("mesa", session.restaurantId, "name") });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const limit = await assertMesaLimit(session.restaurantId);
    if (!limit.ok) {
      return errorResponse(
        limit.reason,
        limit.reason === "mesa_limit"
          ? `Mesa limit reached for the current plan (${limit.subscription.mesa_limit})`
          : "Billing is not active for this restaurant",
        402
      );
    }
    const body = await parseJson(request, mesaBodySchema);
    const createdMesa = await createMesaWithSeatingUnit({ restaurantId: session.restaurantId, ...body });
    return created(createdMesa);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return errorResponse("unauthorized", "Staff session required", 401);
    return handleError(error);
  }
}
