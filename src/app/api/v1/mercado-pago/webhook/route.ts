import {
  recordMercadoPagoEvent,
  upsertMercadoPagoSubscriptionFromObject,
  type MercadoPagoPreapproval
} from "@/features/billing";
import { errorResponse, handleError, json } from "@/lib/http";
import { isMercadoPagoConfigured, mercadoPagoRequest, verifyMercadoPagoSignature } from "@/lib/mercado-pago";

type MercadoPagoWebhook = {
  id?: string | number;
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

type AuthorizedPayment = {
  id: string | number;
  preapproval_id?: string | null;
};

export async function POST(request: Request) {
  if (!isMercadoPagoConfigured()) {
    return errorResponse("mercadopago_missing", "MP_ACCESS_TOKEN is not configured", 503);
  }

  const verification = verifyMercadoPagoSignature(request);
  if (!verification.ok) {
    return errorResponse(`mercadopago_${verification.reason}`, "Invalid Mercado Pago webhook signature", 400);
  }

  let event: MercadoPagoWebhook;
  try {
    event = JSON.parse(await request.text()) as MercadoPagoWebhook;
  } catch {
    return errorResponse("mercadopago_payload_invalid", "Invalid Mercado Pago webhook payload", 400);
  }

  try {
    const urlDataId = new URL(request.url).searchParams.get("data.id");
    const dataId = String(event.data?.id ?? urlDataId ?? "");
    const type = event.type ?? "unknown";
    const eventId = String(event.id ?? `${type}:${event.action ?? "event"}:${dataId}`);
    const firstDelivery = await recordMercadoPagoEvent(eventId, type);
    if (!firstDelivery) return json({ received: true, duplicate: true });

    if ((type === "subscription_preapproval" || type === "subscription") && dataId) {
      const preapproval = await mercadoPagoRequest<MercadoPagoPreapproval>(`/preapproval/${encodeURIComponent(dataId)}`);
      await upsertMercadoPagoSubscriptionFromObject(preapproval);
    }

    if (type === "subscription_authorized_payment" && dataId) {
      const authorizedPayment = await mercadoPagoRequest<AuthorizedPayment>(`/authorized_payments/${encodeURIComponent(dataId)}`);
      if (authorizedPayment.preapproval_id) {
        const preapproval = await mercadoPagoRequest<MercadoPagoPreapproval>(
          `/preapproval/${encodeURIComponent(authorizedPayment.preapproval_id)}`
        );
        await upsertMercadoPagoSubscriptionFromObject(preapproval);
      }
    }

    return json({ received: true });
  } catch (error) {
    return handleError(error);
  }
}
