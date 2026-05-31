import { ensureBillingSubscription, markMercadoPagoSubscriptionCanceled } from "@/features/billing";
import { requireStaffSession } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";
import { mercadoPagoRequest } from "@/lib/mercado-pago";

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const billing = await ensureBillingSubscription(session.restaurantId);
    if (!billing.mercadopago_preapproval_id) {
      return errorResponse("mercadopago_subscription_missing", "Create a Mercado Pago subscription before cancelling it", 409);
    }

    await mercadoPagoRequest(`/preapproval/${encodeURIComponent(billing.mercadopago_preapproval_id)}`, {
      method: "PUT",
      body: { status: "canceled" }
    });
    const subscription = await markMercadoPagoSubscriptionCanceled(session.restaurantId);
    return json({ subscription });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Staff session required", 401);
    }
    if (error instanceof Error && error.message.includes("Mercado Pago is not configured")) {
      return errorResponse("mercadopago_missing", "Configure MP_ACCESS_TOKEN to manage Mercado Pago billing", 503);
    }
    return handleError(error);
  }
}
