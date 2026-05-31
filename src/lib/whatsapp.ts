import { createHmac, timingSafeEqual } from "node:crypto";

type TemplateComponent = {
  type: "body";
  parameters: Array<{ type: "text"; text: string }>;
};

export type WhatsAppTemplateMessage = {
  to: string;
  name: string;
  languageCode: string;
  components?: TemplateComponent[];
};

export interface WhatsAppSender {
  sendText(input: { to: string; body: string }): Promise<{ id?: string }>;
  sendTemplate(input: WhatsAppTemplateMessage): Promise<{ id?: string }>;
}

function normalizeRecipient(value: string) {
  return value.replace(/[^\d]/g, "");
}

function graphVersion() {
  return process.env.WHATSAPP_API_VERSION || "v23.0";
}

class ConsoleWhatsAppSender implements WhatsAppSender {
  async sendText(input: { to: string; body: string }) {
    console.log("[whatsapp:console]", JSON.stringify({ type: "text", ...input }, null, 2));
    return { id: `console-whatsapp-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  }

  async sendTemplate(input: WhatsAppTemplateMessage) {
    console.log("[whatsapp:console]", JSON.stringify({ type: "template", ...input }, null, 2));
    return { id: `console-whatsapp-template-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  }
}

class MetaWhatsAppSender implements WhatsAppSender {
  private async send(body: Record<string, unknown>) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      throw new Error("WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required for Meta WhatsApp");
    }

    const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body })
    });

    if (!response.ok) {
      throw new Error(`WhatsApp failed with ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { messages?: Array<{ id?: string }> };
    return { id: data.messages?.[0]?.id };
  }

  async sendText(input: { to: string; body: string }) {
    return this.send({
      recipient_type: "individual",
      to: normalizeRecipient(input.to),
      type: "text",
      text: { preview_url: false, body: input.body }
    });
  }

  async sendTemplate(input: WhatsAppTemplateMessage) {
    return this.send({
      recipient_type: "individual",
      to: normalizeRecipient(input.to),
      type: "template",
      template: {
        name: input.name,
        language: { code: input.languageCode },
        components: input.components ?? []
      }
    });
  }
}

export function getWhatsAppSender(): WhatsAppSender {
  return process.env.WHATSAPP_PROVIDER === "meta" ? new MetaWhatsAppSender() : new ConsoleWhatsAppSender();
}

export function verifyWhatsAppSignature(rawBody: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!signature?.startsWith("sha256=")) return false;

  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const incoming = Buffer.from(signature);
  const calculated = Buffer.from(expected);
  return incoming.length === calculated.length && timingSafeEqual(incoming, calculated);
}
