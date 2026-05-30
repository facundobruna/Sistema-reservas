import { cookies } from "next/headers";
import { and, eq, ilike } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getBearerToken } from "@/lib/http";
import { signToken, verifyPassword, verifyToken } from "@/lib/crypto";

export type StaffSession = {
  type: "staff";
  staffId: string;
  restaurantId: string;
  role: "owner" | "manager" | "host";
};

export type DinerSession = {
  type: "diner";
  customerId: string;
  reservationId?: string;
};

const STAFF_COOKIE = "staff_session";
const DINER_COOKIE = "diner_session";

export function createStaffToken(session: StaffSession) {
  return signToken(session, 60 * 60 * 24 * 7);
}

export function createDinerToken(session: DinerSession) {
  return signToken(session, 60 * 60 * 24 * 30);
}

export async function setStaffCookie(token: string) {
  const store = await cookies();
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

export async function setDinerCookie(token: string) {
  const store = await cookies();
  store.set(DINER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function getStaffSession(request?: Request): Promise<StaffSession | null> {
  const bearer = request ? getBearerToken(request) : null;
  const token = bearer ?? (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = verifyToken<StaffSession>(token);
  return session?.type === "staff" ? session : null;
}

export async function requireStaffSession(request?: Request) {
  const session = await getStaffSession(request);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getDinerSession(request?: Request): Promise<DinerSession | null> {
  const bearer = request ? getBearerToken(request) : null;
  const token = bearer ?? (await cookies()).get(DINER_COOKIE)?.value;
  if (!token) return null;
  const session = verifyToken<DinerSession>(token);
  return session?.type === "diner" ? session : null;
}

export async function loginStaff(email: string, password: string, restaurantSlug?: string) {
  const db = getDb();
  const rows = await db
    .select({
      staff: schema.staffUser,
      restaurant: schema.restaurant
    })
    .from(schema.staffUser)
    .innerJoin(schema.restaurant, eq(schema.restaurant.id, schema.staffUser.restaurantId))
    .where(
      restaurantSlug
        ? and(ilike(schema.staffUser.email, email), eq(schema.restaurant.slug, restaurantSlug))
        : ilike(schema.staffUser.email, email)
    );

  if (rows.length > 1 && !restaurantSlug) {
    return { error: "ambiguous_restaurant" as const };
  }

  const row = rows[0];
  if (!row || !(await verifyPassword(password, row.staff.passwordHash))) {
    return { error: "invalid_credentials" as const };
  }

  const token = createStaffToken({
    type: "staff",
    staffId: row.staff.id,
    restaurantId: row.restaurant.id,
    role: row.staff.role
  });

  return { token, staff: row.staff, restaurant: row.restaurant };
}
