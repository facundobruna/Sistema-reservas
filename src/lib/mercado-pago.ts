import { createHmac, timingSafeEqual } from "crypto";

const MERCADO_PAGO_API = "https://api.mercadopago.com";

export class MercadoPagoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown
  ) {
    super(message);
  }
}

export function appUrl(request?: Request) {
  return process.env.APP_URL ?? (request ? new URL(request.url).origin : "http://localhost:3000");
}

export function getMercadoPagoAccessToken() {
  return process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN || null;
}

export function isMercadoPagoConfigured() {
  return Boolean(getMercadoPagoAccessToken());
}

export function requireMercadoPagoAccessToken() {
  const token = getMercadoPagoAccessToken();
  if (!token) {
    throw new Error("Mercado Pago is not configured. Set MP_ACCESS_TOKEN to enable billing checkout.");
  }
  return token;
}

export async function mercadoPagoRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {}
) {
  const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${requireMercadoPagoAccessToken()}`,
      "Content-Type": "application/json"
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new MercadoPagoApiError("Mercado Pago API request failed", response.status, payload ?? text);
  }

  return payload as T;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function verifyMercadoPagoSignature(request: Request) {
  const secret = process.env.MP_WEBHOOK_SECRET || process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return { ok: false as const, reason: "secret_missing" };

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature || !xRequestId) return { ok: false as const, reason: "signature_missing" };

  const parts = xSignature.split(",");
  let ts = "";
  let hash = "";
  for (const part of parts) {
    const [key, value] = part.split("=", 2);
    if (key?.trim() === "ts") ts = value?.trim() ?? "";
    if (key?.trim() === "v1") hash = value?.trim() ?? "";
  }
  if (!ts || !hash) return { ok: false as const, reason: "signature_missing" };

  const dataId = new URL(request.url).searchParams.get("data.id")?.toLowerCase() ?? "";
  const manifest = `${dataId ? `id:${dataId};` : ""}request-id:${xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(hash);
  if (expectedBytes.length !== receivedBytes.length || !timingSafeEqual(expectedBytes, receivedBytes)) {
    return { ok: false as const, reason: "signature_invalid" };
  }

  return { ok: true as const };
}
