import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created(data: unknown) {
  return json(data, { status: 201 });
}

export function errorResponse(error: string, message: string, status = 400) {
  return json({ error, message }, { status });
}

export async function parseJson<T>(request: Request, schema: ZodSchema<T>): Promise<T> {
  const body = await request.json().catch(() => undefined);
  return schema.parse(body);
}

export function handleError(error: unknown) {
  if (error instanceof ZodError) {
    return errorResponse("validation_error", error.issues[0]?.message ?? "Invalid input", 422);
  }
  if (error instanceof Error) {
    return errorResponse("internal_error", error.message, 500);
  }
  return errorResponse("internal_error", "Unexpected error", 500);
}

export function getBearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length);
}

export function boolParam(value: string | null) {
  if (value === null) return undefined;
  return value === "true" || value === "1";
}
