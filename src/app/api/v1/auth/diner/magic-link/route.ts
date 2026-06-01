import { z } from "zod";
import { signToken } from "@/lib/crypto";
import { getEmailSender, withTransactionalFooter } from "@/lib/email";
import { handleError, json, parseJson } from "@/lib/http";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  try {
    const { email } = await parseJson(request, schema);
    const token = signToken({ type: "diner_magic", email }, 60 * 15);
    const appUrl = process.env.APP_URL ?? new URL(request.url).origin;
    const link = `${appUrl}/api/v1/auth/diner/verify?token=${encodeURIComponent(token)}`;
    await getEmailSender().send({
      to: email,
      subject: "Tu link de acceso a reservas",
      text: withTransactionalFooter(`Usa este link para acceder a tus reservas: ${link}`)
    });
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
