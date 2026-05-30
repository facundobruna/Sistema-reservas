import { clearStaffCookie } from "@/lib/auth";
import { handleError, json } from "@/lib/http";

export async function POST() {
  try {
    await clearStaffCookie();
    return json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}
