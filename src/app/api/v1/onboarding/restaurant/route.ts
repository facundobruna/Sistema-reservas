import { z } from "zod";
import { createOnboardingTenant } from "@/features/onboarding";
import { createStaffToken, setStaffCookie } from "@/lib/auth";
import { created, errorResponse, handleError, parseJson } from "@/lib/http";

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const onboardingSchema = z.object({
  restaurantName: z.string().min(2).max(120),
  slug: z.string().min(3).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timezone: z.string().min(1).default("America/Argentina/Buenos_Aires"),
  ownerName: z.string().min(2).max(120),
  ownerEmail: z.string().email(),
  password: z.string().min(8).max(120),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#8e3f24"),
  heroImageUrl: z.string().url().optional().nullable().or(z.literal("").transform(() => null)),
  logoUrl: z.string().url().optional().nullable().or(z.literal("").transform(() => null)),
  zoneNames: z.array(z.string().min(1).max(80)).min(1).max(6).default(["Salon principal"]),
  tableProfile: z.enum(["small", "medium", "large"]).default("small"),
  lunchEnabled: z.boolean().default(true),
  dinnerEnabled: z.boolean().default(true),
  lunchStart: timeSchema.default("12:00"),
  lunchEnd: timeSchema.default("15:00"),
  dinnerStart: timeSchema.default("19:30"),
  dinnerEnd: timeSchema.default("23:30"),
  slotIntervalMin: z.coerce.number().int().min(15).max(60).default(30),
  turnDurationMin: z.coerce.number().int().min(45).max(180).default(90),
  pacingCap: z.coerce.number().int().positive().max(500).optional().nullable()
});

function snippets(origin: string, slug: string) {
  return {
    bookingUrl: `${origin}/r/${slug}`,
    adminUrl: `${origin}/admin`,
    embedUrl: `${origin}/embed/${slug}`,
    iframe: `<iframe src="${origin}/r/${slug}?embed=1" style="width:100%;height:720px;border:0;border-radius:8px" loading="lazy"></iframe>`,
    script: `<script async src="${origin}/embed/${slug}/script"></script>`
  };
}

export async function POST(request: Request) {
  try {
    const body = await parseJson(request, onboardingSchema);
    const result = await createOnboardingTenant(body);
    const token = createStaffToken({
      type: "staff",
      staffId: result.staff.id,
      restaurantId: result.restaurant.id,
      role: "owner"
    });
    await setStaffCookie(token);

    const origin = process.env.APP_URL ?? new URL(request.url).origin;
    return created({
      ...result,
      token,
      links: snippets(origin, result.restaurant.slug)
    });
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return errorResponse("slug_or_email_taken", "That restaurant slug or staff email already exists", 409);
    }
    return handleError(error);
  }
}
