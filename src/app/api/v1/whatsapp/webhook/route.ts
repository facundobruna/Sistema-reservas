import { extractWhatsAppTextMessages, processIncomingWhatsAppMessage } from "@/features/whatsappBot";
import { errorResponse, handleError, json } from "@/lib/http";
import { verifyWhatsAppSignature } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }

  return errorResponse("unauthorized", "Invalid WhatsApp verify token", 401);
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    if (!verifyWhatsAppSignature(rawBody, request.headers.get("x-hub-signature-256"))) {
      return errorResponse("unauthorized", "Invalid WhatsApp signature", 401);
    }

    const payload = JSON.parse(rawBody) as unknown;
    const messages = extractWhatsAppTextMessages(payload);
    const results = [];
    for (const message of messages) {
      results.push(await processIncomingWhatsAppMessage(message));
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    return handleError(error);
  }
}
