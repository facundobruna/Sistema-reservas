type OpenAiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StructuredJsonInput = {
  model?: string;
  messages: OpenAiMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens?: number;
};

function openAiBaseUrl() {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

export function isOpenAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function extractOutputText(payload: unknown) {
  const response = payload as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };

  if (typeof response.output_text === "string") return response.output_text;

  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  return null;
}

export async function requestOpenAiStructuredJson<T>(input: StructuredJsonInput): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for OpenAI requests");
  }

  const response = await fetch(`${openAiBaseUrl()}/responses`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: input.model || process.env.WHATSAPP_AI_MODEL || "gpt-4o-mini",
      input: input.messages,
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.schema
        }
      },
      max_output_tokens: input.maxOutputTokens ?? 500
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI request failed with ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  const text = extractOutputText(payload);
  if (!text) {
    throw new Error("OpenAI response did not include output text");
  }

  return JSON.parse(text) as T;
}
