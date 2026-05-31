import { hashPassword } from "@/lib/crypto";
import { getPool } from "@/lib/db";

export type OnboardingInput = {
  restaurantName: string;
  slug: string;
  timezone: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  accent: string;
  heroImageUrl?: string | null;
  logoUrl?: string | null;
  zoneNames: string[];
  tableProfile: "small" | "medium" | "large";
  lunchEnabled: boolean;
  dinnerEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
  slotIntervalMin: number;
  turnDurationMin: number;
  pacingCap?: number | null;
};

export type OnboardingResult = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
  staff: {
    id: string;
    email: string;
    name: string;
  };
  counts: {
    zones: number;
    mesas: number;
    services: number;
    shifts: number;
  };
};

const tableProfiles: Record<OnboardingInput["tableProfile"], Array<{ size: 2 | 4 | 6; count: number }>> = {
  small: [
    { size: 2, count: 4 },
    { size: 4, count: 4 },
    { size: 6, count: 1 }
  ],
  medium: [
    { size: 2, count: 6 },
    { size: 4, count: 8 },
    { size: 6, count: 2 }
  ],
  large: [
    { size: 2, count: 10 },
    { size: 4, count: 14 },
    { size: 6, count: 4 }
  ]
};

export async function createOnboardingTenant(input: OnboardingInput): Promise<OnboardingResult> {
  const pool = getPool();
  const client = await pool.connect();
  const passwordHash = await hashPassword(input.password);
  const zones = input.zoneNames.map((name) => name.trim()).filter(Boolean);
  const services = [
    input.lunchEnabled ? { name: "Almuerzo", start: input.lunchStart, end: input.lunchEnd, position: 0 } : null,
    input.dinnerEnabled ? { name: "Cena", start: input.dinnerStart, end: input.dinnerEnd, position: 1 } : null
  ].filter((service): service is { name: string; start: string; end: string; position: number } => Boolean(service));
  const effectiveServices = services.length
    ? services
    : [{ name: "Cena", start: input.dinnerStart, end: input.dinnerEnd, position: 0 }];

  try {
    await client.query("BEGIN");

    const restaurantResult = await client.query<{ id: string; name: string; slug: string }>(
      `INSERT INTO restaurant (slug, name, timezone, settings)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, name, slug`,
      [
        input.slug,
        input.restaurantName,
        input.timezone,
        JSON.stringify({
          branding: {
            accent: input.accent,
            heroImageUrl: input.heroImageUrl || null,
            logoUrl: input.logoUrl || null
          },
          bookingWindow: { maxDaysAhead: 45, minHoursBefore: 2 },
          reminderHoursBefore: 4
        })
      ]
    );
    const restaurant = restaurantResult.rows[0];

    await client.query(
      `INSERT INTO billing_subscription
         (restaurant_id, plan_key, status, trial_ends_at, monthly_reservation_limit, mesa_limit)
       VALUES ($1, 'growth', 'trialing', now() + interval '14 days', 1200, 40)`,
      [restaurant.id]
    );

    const staffResult = await client.query<{ id: string; email: string; name: string }>(
      `INSERT INTO staff_user (restaurant_id, email, name, role, password_hash)
       VALUES ($1, $2, $3, 'owner', $4)
       RETURNING id, email::text, name`,
      [restaurant.id, input.ownerEmail.toLowerCase(), input.ownerName, passwordHash]
    );
    const staff = staffResult.rows[0];

    const zoneIds: string[] = [];
    for (const [index, zoneName] of zones.entries()) {
      const zone = await client.query<{ id: string }>(
        "INSERT INTO zone (restaurant_id, name, position) VALUES ($1, $2, $3) RETURNING id",
        [restaurant.id, zoneName, index]
      );
      zoneIds.push(zone.rows[0].id);
    }

    const mesaShape = tableProfiles[input.tableProfile];
    let mesaCount = 0;
    for (const item of mesaShape) {
      for (let index = 0; index < item.count; index += 1) {
        const zoneId = zoneIds[mesaCount % zoneIds.length];
        const mesaName = `${item.size}P-${index + 1}`;
        const mesa = await client.query<{ id: string }>(
          `INSERT INTO mesa (restaurant_id, zone_id, name, min_capacity, max_capacity)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [restaurant.id, zoneId, mesaName, item.size === 2 ? 1 : Math.max(2, item.size - 2), item.size]
        );
        const unit = await client.query<{ id: string }>(
          `INSERT INTO seating_unit (restaurant_id, name, kind, min_capacity, max_capacity)
           VALUES ($1, $2, 'single', $3, $4)
           RETURNING id`,
          [restaurant.id, mesaName, item.size === 2 ? 1 : Math.max(2, item.size - 2), item.size]
        );
        await client.query("INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id) VALUES ($1, $2)", [
          unit.rows[0].id,
          mesa.rows[0].id
        ]);
        mesaCount += 1;
      }
    }

    let shiftCount = 0;
    for (const service of effectiveServices) {
      const serviceResult = await client.query<{ id: string }>(
        "INSERT INTO service (restaurant_id, name, position) VALUES ($1, $2, $3) RETURNING id",
        [restaurant.id, service.name, service.position]
      );
      for (let day = 0; day <= 6; day += 1) {
        await client.query(
          `INSERT INTO shift
             (restaurant_id, service_id, day_of_week, start_time, end_time, slot_interval_min,
              turn_duration_min, seating_mode, pacing_cap)
           VALUES ($1, $2, $3, $4::time, $5::time, $6, $7, 'rolling', $8)`,
          [
            restaurant.id,
            serviceResult.rows[0].id,
            day,
            service.start,
            service.end,
            input.slotIntervalMin,
            input.turnDurationMin,
            input.pacingCap ?? null
          ]
        );
        shiftCount += 1;
      }
    }

    await client.query("COMMIT");
    return {
      restaurant,
      staff,
      counts: {
        zones: zoneIds.length,
        mesas: mesaCount,
        services: effectiveServices.length,
        shifts: shiftCount
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
