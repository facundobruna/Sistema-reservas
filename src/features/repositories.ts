import { DateTime } from "luxon";
import { asc, eq } from "drizzle-orm";
import { getDb, getPool, schema } from "@/lib/db";
import type {
  ActiveReservation,
  ScheduleExceptionConfig,
  SeatingUnitConfig,
  ShiftConfig
} from "@/features/availability";

export type PublicRestaurant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  settings: Record<string, unknown>;
  zones: Array<{ id: string; name: string; position: number }>;
  services: Array<{ id: string; name: string; position: number }>;
};

export async function getRestaurantBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.restaurant).where(eq(schema.restaurant.slug, slug)).limit(1);
  return row ?? null;
}

export async function getRestaurantById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(schema.restaurant).where(eq(schema.restaurant.id, id)).limit(1);
  return row ?? null;
}

export async function getPublicRestaurant(slug: string): Promise<PublicRestaurant | null> {
  const restaurant = await getRestaurantBySlug(slug);
  if (!restaurant) return null;
  const db = getDb();
  const [zones, services] = await Promise.all([
    db
      .select({ id: schema.zone.id, name: schema.zone.name, position: schema.zone.position })
      .from(schema.zone)
      .where(eq(schema.zone.restaurantId, restaurant.id))
      .orderBy(asc(schema.zone.position), asc(schema.zone.name)),
    db
      .select({ id: schema.service.id, name: schema.service.name, position: schema.service.position })
      .from(schema.service)
      .where(eq(schema.service.restaurantId, restaurant.id))
      .orderBy(asc(schema.service.position), asc(schema.service.name))
  ]);
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    timezone: restaurant.timezone,
    suspendedAt: restaurant.suspendedAt,
    suspendedReason: restaurant.suspendedReason,
    settings: (restaurant.settings as Record<string, unknown>) ?? {},
    zones,
    services
  };
}

export async function loadAvailabilityContext(restaurantId: string, date: string, timezone: string) {
  const pool = getPool();
  const day = DateTime.fromISO(date, { zone: timezone });
  const dayOfWeek = day.weekday % 7;
  const dayStart = day.startOf("day").toUTC().toISO();
  const dayEnd = day.plus({ days: 1 }).startOf("day").toUTC().toISO();

  const [shiftRows, unitRows, reservationRows, exceptionRows] = await Promise.all([
    pool.query<{
      id: string;
      service_id: string;
      zone_id: string | null;
      start_time: string;
      end_time: string;
      slot_interval_min: number;
      turn_duration_min: number;
      seating_mode: "rolling" | "fixed";
      fixed_times: string[] | null;
      pacing_cap: number | null;
    }>(
      `SELECT id, service_id, zone_id, start_time::text, end_time::text, slot_interval_min,
              turn_duration_min, seating_mode, fixed_times::text[], pacing_cap
       FROM shift
       WHERE restaurant_id = $1 AND day_of_week = $2
       ORDER BY start_time, created_at`,
      [restaurantId, dayOfWeek]
    ),
    pool.query<{
      id: string;
      name: string;
      min_capacity: number;
      max_capacity: number;
      active: boolean;
      mesa_ids: string[];
      zone_ids: string[];
    }>(
      `SELECT su.id, su.name, su.min_capacity, su.max_capacity, su.active,
              array_agg(sum.mesa_id ORDER BY m.name) AS mesa_ids,
              array_agg(DISTINCT m.zone_id) AS zone_ids
       FROM seating_unit su
       JOIN seating_unit_mesa sum ON sum.seating_unit_id = su.id
       JOIN mesa m ON m.id = sum.mesa_id
       WHERE su.restaurant_id = $1 AND su.active = true AND m.active = true
       GROUP BY su.id
       ORDER BY su.max_capacity, su.min_capacity, su.name`,
      [restaurantId]
    ),
    pool.query<{
      id: string;
      starts_at: Date;
      ends_at: Date;
      party_size: number;
      mesa_ids: string[];
    }>(
      `SELECT r.id, r.starts_at, r.ends_at, r.party_size,
              array_agg(rm.mesa_id ORDER BY rm.mesa_id) AS mesa_ids
       FROM reservation r
       JOIN reservation_mesa rm ON rm.reservation_id = r.id
       WHERE r.restaurant_id = $1
         AND r.status NOT IN ('cancelled', 'no_show')
         AND r.starts_at < $3::timestamptz
         AND r.ends_at > $2::timestamptz
       GROUP BY r.id
       ORDER BY r.starts_at`,
      [restaurantId, dayStart, dayEnd]
    ),
    pool.query<{
      kind: "closed" | "special_hours";
      start_time: string | null;
      end_time: string | null;
    }>(
      `SELECT kind, start_time::text, end_time::text
       FROM schedule_exception
       WHERE restaurant_id = $1 AND date = $2::date
       ORDER BY created_at DESC
       LIMIT 1`,
      [restaurantId, date]
    )
  ]);

  const shifts: ShiftConfig[] = shiftRows.rows.map((row) => ({
    id: row.id,
    serviceId: row.service_id,
    zoneId: row.zone_id,
    startTime: row.start_time,
    endTime: row.end_time,
    slotIntervalMin: row.slot_interval_min,
    turnDurationMin: row.turn_duration_min,
    seatingMode: row.seating_mode,
    fixedTimes: row.fixed_times,
    pacingCap: row.pacing_cap
  }));

  const units: SeatingUnitConfig[] = unitRows.rows.map((row) => ({
    id: row.id,
    name: row.name,
    minCapacity: row.min_capacity,
    maxCapacity: row.max_capacity,
    active: row.active,
    mesaIds: row.mesa_ids,
    zoneIds: row.zone_ids
  }));

  const reservations: ActiveReservation[] = reservationRows.rows.map((row) => ({
    id: row.id,
    startsAt: DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(timezone),
    endsAt: DateTime.fromJSDate(row.ends_at, { zone: "utc" }).setZone(timezone),
    partySize: row.party_size,
    mesaIds: row.mesa_ids
  }));

  const exception: ScheduleExceptionConfig | null = exceptionRows.rows[0]
    ? {
        kind: exceptionRows.rows[0].kind,
        startTime: exceptionRows.rows[0].start_time,
        endTime: exceptionRows.rows[0].end_time
      }
    : null;

  return { shifts, units, reservations, exception };
}

export async function createMesaWithSeatingUnit(input: {
  restaurantId: string;
  zoneId: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  active?: boolean;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const mesaResult = await client.query<{ id: string }>(
      `INSERT INTO mesa (restaurant_id, zone_id, name, min_capacity, max_capacity, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [input.restaurantId, input.zoneId, input.name, input.minCapacity, input.maxCapacity, input.active ?? true]
    );
    const mesaId = mesaResult.rows[0].id;
    const unitResult = await client.query<{ id: string }>(
      `INSERT INTO seating_unit (restaurant_id, name, kind, min_capacity, max_capacity, active)
       VALUES ($1, $2, 'single', $3, $4, $5)
       RETURNING id`,
      [input.restaurantId, input.name, input.minCapacity, input.maxCapacity, input.active ?? true]
    );
    const seatingUnitId = unitResult.rows[0].id;
    await client.query("INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id) VALUES ($1, $2)", [
      seatingUnitId,
      mesaId
    ]);
    await client.query("COMMIT");
    return { mesaId, seatingUnitId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createSeatingUnitCombo(input: {
  restaurantId: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  mesaIds: string[];
  active?: boolean;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const unitResult = await client.query<{ id: string }>(
      `INSERT INTO seating_unit (restaurant_id, name, kind, min_capacity, max_capacity, active)
       VALUES ($1, $2, 'combo', $3, $4, $5)
       RETURNING id`,
      [input.restaurantId, input.name, input.minCapacity, input.maxCapacity, input.active ?? true]
    );
    const seatingUnitId = unitResult.rows[0].id;
    for (const mesaId of input.mesaIds) {
      await client.query("INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id) VALUES ($1, $2)", [
        seatingUnitId,
        mesaId
      ]);
    }
    await client.query("COMMIT");
    return { seatingUnitId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function assertRestaurantScoped(tableName: "zone" | "mesa" | "service" | "shift" | "schedule_exception" | "seating_unit", id: string, restaurantId: string) {
  const pool = getPool();
  const result = await pool.query(`SELECT 1 FROM ${tableName} WHERE id = $1 AND restaurant_id = $2`, [id, restaurantId]);
  return Boolean(result.rowCount);
}

export async function listAdminSummary(restaurantId: string) {
  const db = getDb();
  const restaurant = await getRestaurantById(restaurantId);
  const [zones, mesas, seatingUnits, services, shifts, exceptions] = await Promise.all([
    db.select().from(schema.zone).where(eq(schema.zone.restaurantId, restaurantId)).orderBy(asc(schema.zone.position)),
    db.select().from(schema.mesa).where(eq(schema.mesa.restaurantId, restaurantId)).orderBy(asc(schema.mesa.name)),
    db
      .select()
      .from(schema.seatingUnit)
      .where(eq(schema.seatingUnit.restaurantId, restaurantId))
      .orderBy(asc(schema.seatingUnit.maxCapacity), asc(schema.seatingUnit.name)),
    db.select().from(schema.service).where(eq(schema.service.restaurantId, restaurantId)).orderBy(asc(schema.service.position)),
    db
      .select()
      .from(schema.shift)
      .where(eq(schema.shift.restaurantId, restaurantId))
      .orderBy(asc(schema.shift.dayOfWeek), asc(schema.shift.startTime)),
    db
      .select()
      .from(schema.scheduleException)
      .where(eq(schema.scheduleException.restaurantId, restaurantId))
      .orderBy(asc(schema.scheduleException.date))
  ]);

  return { restaurant, zones, mesas, seatingUnits, services, shifts, exceptions };
}

export async function updateRestaurantSettings(restaurantId: string, input: { name?: string; timezone?: string; settings?: Record<string, unknown> }) {
  const current = await getRestaurantById(restaurantId);
  if (!current) return null;
  const db = getDb();
  const [updated] = await db
    .update(schema.restaurant)
    .set({
      name: input.name ?? current.name,
      timezone: input.timezone ?? current.timezone,
      settings: input.settings ? { ...(current.settings as Record<string, unknown>), ...input.settings } : current.settings,
      updatedAt: new Date()
    })
    .where(eq(schema.restaurant.id, restaurantId))
    .returning();
  return updated;
}

export async function ensureCustomer(input: { restaurantId: string; name: string; email?: string | null; phone: string }) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const customerResult = await client.query<{ id: string }>(
      `INSERT INTO customer (phone, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (phone)
       DO UPDATE SET email = COALESCE(EXCLUDED.email, customer.email),
                     name = COALESCE(EXCLUDED.name, customer.name)
       RETURNING id`,
      [input.phone, input.email ?? null, input.name]
    );
    const customerId = customerResult.rows[0].id;
    await client.query(
      `INSERT INTO customer_restaurant (restaurant_id, customer_id)
       VALUES ($1, $2)
       ON CONFLICT (restaurant_id, customer_id) DO NOTHING`,
      [input.restaurantId, customerId]
    );
    await client.query("COMMIT");
    return customerId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
