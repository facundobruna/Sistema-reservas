import { clearSuperAdminCookie } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST() {
  await clearSuperAdminCookie();
  return json({ ok: true });
}
