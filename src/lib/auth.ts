import { cookies } from "next/headers";
import { and, eq, ilike } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getBearerToken } from "@/lib/http";
import { hashPassword, signToken, verifyPassword, verifyToken } from "@/lib/crypto";

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

export type SuperAdminSession = {
  type: "super_admin";
  superAdminId: string;
  email: string;
  role: "owner" | "support";
};

const STAFF_COOKIE = "staff_session";
const DINER_COOKIE = "diner_session";
const SUPER_ADMIN_COOKIE = "super_admin_session";

function shouldUseSecureCookies() {
  if (process.env.AUTH_COOKIE_SECURE) {
    return process.env.AUTH_COOKIE_SECURE === "true";
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.startsWith("https://");
  }
  return process.env.NODE_ENV === "production";
}

export function createStaffToken(session: StaffSession) {
  return signToken(session, 60 * 60 * 24 * 7);
}

export function createDinerToken(session: DinerSession) {
  return signToken(session, 60 * 60 * 24 * 30);
}

export function createSuperAdminToken(session: SuperAdminSession) {
  return signToken(session, 60 * 60 * 8);
}

export async function setStaffCookie(token: string) {
  const store = await cookies();
  store.set(STAFF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.delete(STAFF_COOKIE);
}

export async function setSuperAdminCookie(token: string) {
  const store = await cookies();
  store.set(SUPER_ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSuperAdminCookie() {
  const store = await cookies();
  store.delete(SUPER_ADMIN_COOKIE);
}

export async function setDinerCookie(token: string) {
  const store = await cookies();
  store.set(DINER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookies(),
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

export async function getSuperAdminSession(request?: Request): Promise<SuperAdminSession | null> {
  const bearer = request ? getBearerToken(request) : null;
  const token = bearer ?? (await cookies()).get(SUPER_ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = verifyToken<SuperAdminSession>(token);
  return session?.type === "super_admin" ? session : null;
}

export async function requireSuperAdminSession(request?: Request) {
  const session = await getSuperAdminSession(request);
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getDinerSession(request?: Request): Promise<DinerSession | null> {
  const bearer = request ? getBearerToken(request) : null;
  const linkToken = request ? new URL(request.url).searchParams.get("token") : null;
  const token = bearer ?? linkToken ?? (await cookies()).get(DINER_COOKIE)?.value;
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

export async function loginSuperAdmin(email: string, password: string) {
  const db = getDb();
  let rows = await db
    .select()
    .from(schema.superAdminUser)
    .where(ilike(schema.superAdminUser.email, email))
    .limit(1);

  if (!rows[0]) {
    const bootstrapEmail = process.env.SUPER_ADMIN_EMAIL;
    const bootstrapPassword = process.env.SUPER_ADMIN_PASSWORD;
    if (bootstrapEmail && bootstrapPassword && bootstrapEmail.toLowerCase() === email.toLowerCase() && bootstrapPassword === password) {
      rows = await db
        .insert(schema.superAdminUser)
        .values({
          email: bootstrapEmail,
          name: process.env.SUPER_ADMIN_NAME || "Super Admin",
          role: "owner",
          passwordHash: await hashPassword(bootstrapPassword),
          lastLoginAt: new Date()
        })
        .returning();
    }
  }

  const superAdmin = rows[0];
  if (!superAdmin || !(await verifyPassword(password, superAdmin.passwordHash))) {
    return { error: "invalid_credentials" as const };
  }

  await db.update(schema.superAdminUser).set({ lastLoginAt: new Date() }).where(eq(schema.superAdminUser.id, superAdmin.id));

  const token = createSuperAdminToken({
    type: "super_admin",
    superAdminId: superAdmin.id,
    email: superAdmin.email,
    role: superAdmin.role === "support" ? "support" : "owner"
  });

  return { token, superAdmin };
}
