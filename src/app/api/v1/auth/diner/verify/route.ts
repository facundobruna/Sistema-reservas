import { and, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/crypto";
import { getDb, schema as dbSchema } from "@/lib/db";
import { createDinerToken, setDinerCookie } from "@/lib/auth";
import { errorResponse, handleError, json } from "@/lib/http";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) return errorResponse("validation_error", "Missing token", 422);
    return verifyMagic(token);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  try {
    const token = ((await request.json().catch(() => ({}))) as { token?: string }).token;
    if (!token) return errorResponse("validation_error", "Missing token", 422);
    return verifyMagic(token);
  } catch (error) {
    return handleError(error);
  }
}

async function verifyMagic(token: string) {
  const payload = verifyToken<{ type: string; email: string }>(token);
  if (!payload || payload.type !== "diner_magic") {
    return errorResponse("invalid_token", "Invalid or expired token", 401);
  }

  const db = getDb();
  const [customer] = await db
    .select()
    .from(dbSchema.customer)
    .where(and(eq(dbSchema.customer.email, payload.email)))
    .limit(1);
  if (!customer) return errorResponse("not_found", "No customer exists for this email yet", 404);

  const dinerToken = createDinerToken({ type: "diner", customerId: customer.id });
  await setDinerCookie(dinerToken);
  return json({ token: dinerToken });
}
