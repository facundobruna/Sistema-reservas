export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
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
        text: message.text
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
