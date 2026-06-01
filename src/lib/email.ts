export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  headers?: Record<string, string>;
};

export interface EmailSender {
  send(message: EmailMessage): Promise<{ id?: string }>;
}

class ConsoleEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    console.log("[email:console]", JSON.stringify(message, null, 2));
    return { id: `console-${Date.now()}` };
  }
}

class ResendEmailSender implements EmailSender {
  async send(message: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      throw new Error("RESEND_API_KEY and EMAIL_FROM are required for Resend");
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        reply_to: message.replyTo || process.env.EMAIL_REPLY_TO || undefined,
        headers: message.headers
      })
    });

    if (!response.ok) {
      throw new Error(`Resend failed with ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as { id?: string };
    return { id: data.id };
  }
}

export function getEmailSender(): EmailSender {
  return process.env.EMAIL_PROVIDER === "resend" ? new ResendEmailSender() : new ConsoleEmailSender();
}

export function withTransactionalFooter(text: string, input?: { manageUrl?: string; privacyUrl?: string }) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const privacyUrl = input?.privacyUrl ?? `${appUrl}/legal/privacy`;
  const lines = [
    text,
    "",
    input?.manageUrl ? `Gestionar reserva: ${input.manageUrl}` : null,
    `Privacidad y datos: ${privacyUrl}`,
    "",
    "Este es un mensaje transaccional sobre una reserva o acceso solicitado. No es publicidad ni una lista de marketing."
  ].filter(Boolean);
  return lines.join("\n");
}
