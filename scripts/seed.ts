import "dotenv/config";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/crypto";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed");
}

const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const password = process.env.STAFF_DEMO_PASSWORD ?? "admin123";
  const passwordHash = await hashPassword(password);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM restaurant WHERE slug = 'demo-bistro'");

    const restaurant = await client.query<{ id: string }>(
      `INSERT INTO restaurant (slug, name, timezone, settings)
       VALUES (
         'demo-bistro',
         'Demo Bistro',
         'America/Argentina/Buenos_Aires',
         '{"branding":{"accent":"#0f766e","logoUrl":""},"bookingWindow":{"maxDaysAhead":45,"minHoursBefore":2},"reminderHoursBefore":4}'::jsonb
       )
       RETURNING id`
    );
    const restaurantId = restaurant.rows[0].id;

    await client.query(
      `INSERT INTO staff_user (restaurant_id, email, name, role, password_hash)
       VALUES ($1, 'owner@demo-bistro.test', 'Demo Owner', 'owner', $2)`,
      [restaurantId, passwordHash]
    );

    const mainZone = await client.query<{ id: string }>(
      "INSERT INTO zone (restaurant_id, name, position) VALUES ($1, 'Salon principal', 0) RETURNING id",
      [restaurantId]
    );
    const patioZone = await client.query<{ id: string }>(
      "INSERT INTO zone (restaurant_id, name, position) VALUES ($1, 'Patio', 1) RETURNING id",
      [restaurantId]
    );

    const dinner = await client.query<{ id: string }>(
      "INSERT INTO service (restaurant_id, name, position) VALUES ($1, 'Cena', 0) RETURNING id",
      [restaurantId]
    );
    const lunch = await client.query<{ id: string }>(
      "INSERT INTO service (restaurant_id, name, position) VALUES ($1, 'Almuerzo', 1) RETURNING id",
      [restaurantId]
    );

    const mesas = [
      ["M1", mainZone.rows[0].id, 1, 2],
      ["M2", mainZone.rows[0].id, 1, 2],
      ["M3", mainZone.rows[0].id, 2, 4],
      ["M4", mainZone.rows[0].id, 2, 4],
      ["P1", patioZone.rows[0].id, 2, 4],
      ["P2", patioZone.rows[0].id, 4, 6]
    ] as const;

    const mesaIds: Record<string, string> = {};
    for (const [name, zoneId, minCapacity, maxCapacity] of mesas) {
      const mesa = await client.query<{ id: string }>(
        `INSERT INTO mesa (restaurant_id, zone_id, name, min_capacity, max_capacity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [restaurantId, zoneId, name, minCapacity, maxCapacity]
      );
      const mesaId = mesa.rows[0].id;
      mesaIds[name] = mesaId;
      const unit = await client.query<{ id: string }>(
        `INSERT INTO seating_unit (restaurant_id, name, kind, min_capacity, max_capacity)
         VALUES ($1, $2, 'single', $3, $4)
         RETURNING id`,
        [restaurantId, name, minCapacity, maxCapacity]
      );
      await client.query("INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id) VALUES ($1, $2)", [
        unit.rows[0].id,
        mesaId
      ]);
    }

    const combo = await client.query<{ id: string }>(
      `INSERT INTO seating_unit (restaurant_id, name, kind, min_capacity, max_capacity)
       VALUES ($1, 'M3 + M4', 'combo', 5, 8)
       RETURNING id`,
      [restaurantId]
    );
    await client.query("INSERT INTO seating_unit_mesa (seating_unit_id, mesa_id) VALUES ($1, $2), ($1, $3)", [
      combo.rows[0].id,
      mesaIds.M3,
      mesaIds.M4
    ]);

    for (let day = 0; day <= 6; day += 1) {
      await client.query(
        `INSERT INTO shift
          (restaurant_id, service_id, day_of_week, start_time, end_time, slot_interval_min,
           turn_duration_min, seating_mode, pacing_cap)
         VALUES ($1, $2, $3, '19:30', '23:30', 30, 90, 'rolling', 14)`,
        [restaurantId, dinner.rows[0].id, day]
      );
      await client.query(
        `INSERT INTO shift
          (restaurant_id, service_id, day_of_week, start_time, end_time, slot_interval_min,
           turn_duration_min, seating_mode, fixed_times, pacing_cap)
         VALUES ($1, $2, $3, '12:00', '15:00', 30, 75, 'fixed', ARRAY['12:00','13:30']::time[], 18)`,
        [restaurantId, lunch.rows[0].id, day]
      );
    }

    await client.query("COMMIT");
    console.log("Seed complete: demo-bistro / owner@demo-bistro.test /", password);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
