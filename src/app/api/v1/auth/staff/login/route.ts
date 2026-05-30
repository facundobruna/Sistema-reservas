import { z } from "zod";
import { loginStaff, setStaffCookie } from "@/lib/auth";
import { errorResponse, handleError, json, parseJson } from "@/lib/http";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  restaurantSlug: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, loginSchema);
    const result = await loginStaff(body.email, body.password, body.restaurantSlug);
    if ("error" in result) {
      return result.error === "ambiguous_restaurant"
        ? errorResponse("ambiguous_restaurant", "Provide restaurantSlug for this staff email", 409)
        : errorResponse("invalid_credentials", "Invalid credentials", 401);
    }
    await setStaffCookie(result.token);
    return json({
      token: result.token,
      staff: {
        id: result.staff.id,
        email: result.staff.email,
        name: result.staff.name,
        role: result.staff.role
      },
      restaurant: {
        id: result.restaurant.id,
        slug: result.restaurant.slug,
        name: result.restaurant.name
      }
    });
  } catch (error) {
    return handleError(error);
  }
}
