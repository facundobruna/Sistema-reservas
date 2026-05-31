import { z } from "zod";
import {
  attachMercadoPagoPreapproval,
  billingPlans,
  ensureBillingSubscription,
  externalReferenceFor
} from "@/features/billing";
import { requireStaffSession } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";
import { appUrl, mercadoPagoRequest } from "@/lib/mercado-pago";

const checkoutSchema = z.object({
  planKey: z.enum(["starter", "growth", "scale"])
});

type MercadoPagoPreapprovalResponse = {
  id: string;
  preapproval_plan_id?: string | null;
  payer_id?: string | number | null;
  payer_email?: string | null;
  init_point?: string | null;
  status?: string | null;
  date_created?: string | null;
  next_payment_date?: string | null;
};

async function staffBillingContact(staffId: string) {
  const result = await getPool().query<{ email: string; name: string; restaurant_name: string }>(
    `SELECT su.email::text AS email, su.name, r.name AS restaurant_name
     FROM staff_user su
     JOIN restaurant r ON r.id = su.restaurant_id
     WHERE su.id = $1`,
    [staffId]
  );
  return result.rows[0] ?? null;
}

export async function POST(request: Request) {
  try {
    const session = await requireStaffSession(request);
    const body = await parseJson(request, checkoutSchema);
    const plan = billingPlans[body.planKey];
    const billing = await ensureBillingSubscription(session.restaurantId);
    const staff = await staffBillingContact(session.staffId);
    const payerEmail = staff?.email;
    if (!payerEmail) {
      return errorResponse("billing_email_missing", "Staff email is required to create a Mercado Pago subscription", 409);
    }

    const origin = appUrl(request);
    const preapproval = await mercadoPagoRequest<MercadoPagoPreapprovalResponse>("/preapproval", {
      method: "POST",
      body: {
        reason: `Reservas ${plan.name} - ${staff?.restaurant_name ?? "Restaurante"}`,
        external_reference: externalReferenceFor(session.restaurantId, body.planKey),
        payer_email: payerEmail,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: plan.amount,
          currency_id: plan.currencyId
        },
        back_url: `${origin}/admin?tab=billing&checkout=success`,
        status: "pending"
      }
    });

    await attachMercadoPagoPreapproval(session.restaurantId, body.planKey, preapproval, payerEmail);

    return json({ url: preapproval.init_point ?? billing.mercadopago_init_point, preapprovalId: preapproval.id });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return errorResponse("unauthorized", "Staff session required", 401);
    }
    if (error instanceof Error && error.message.includes("Mercado Pago is not configured")) {
      return errorResponse("mercadopago_missing", "Configure MP_ACCESS_TOKEN to enable Mercado Pago billing", 503);
    }
    return handleError(error);
  }
}
