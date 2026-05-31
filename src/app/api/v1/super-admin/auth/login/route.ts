import { z } from "zod";
import { loginSuperAdmin, setSuperAdminCookie } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, loginSchema);
    const result = await loginSuperAdmin(body.email, body.password);
    if ("error" in result) {
      return errorResponse("invalid_credentials", "Invalid credentials", 401);
    }
    await setSuperAdminCookie(result.token);
    return json({
      token: result.token,
      superAdmin: {
        id: result.superAdmin.id,
        email: result.superAdmin.email,
        name: result.superAdmin.name,
        role: result.superAdmin.role
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
