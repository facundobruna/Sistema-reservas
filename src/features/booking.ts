import { DateTime } from "luxon";
import { getPool } from "@/lib/db";
import { createDinerToken } from "@/lib/auth";
import { computeAvailability, getCandidateUnitsForSlot } from "@/features/availability";
import { ensureCustomer, getRestaurantBySlug, loadAvailabilityContext } from "@/features/repositories";
import { scheduleReservationNotifications } from "@/features/notifications";

const EXCLUSION_VIOLATION = "23P01";

export type ReservationInput = {
  slug: string;
  date: string;
  time: string;
  partySize: number;
  zoneId?: string | null;
  serviceId?: string | null;
  customer: {
    name: string;
    email?: string | null;
    phone: string;
  };
  specialRequests?: string | null;
  source: "web" | "manual" | "whatsapp";
};

export type ReservationResult =
  | {
      ok: true;
      reservation: {
        id: string;
        status: string;
        startsAt: string;
        endsAt: string;
        partySize: number;
        serviceId: string | null;
        zoneId: string | null;
        seatingUnitId: string | null;
      };
      dinerToken: string;
    }
  | { ok: false; error: "restaurant_not_found" | "restaurant_suspended" | "slot_unavailable" };

function sameInstant(left: DateTime, right: DateTime) {
  return left.toUTC().toMillis() === right.toUTC().toMillis();
}

export async function createReservation(input: ReservationInput): Promise<ReservationResult> {
  const restaurant = await getRestaurantBySlug(input.slug);
  if (!restaurant) return { ok: false, error: "restaurant_not_found" };
  if (restaurant.suspendedAt) return { ok: false, error: "restaurant_suspended" };

  const requestedStart = DateTime.fromISO(input.time, { setZone: true }).setZone(restaurant.timezone);
  const context = await loadAvailabilityContext(restaurant.id, input.date, restaurant.timezone);
  const availability = computeAvailability({
    request: {
      date: input.date,
      partySize: input.partySize,
      zoneId: input.zoneId,
      serviceId: input.serviceId
    },
    shifts: context.shifts,
    units: context.units,
    reservations: context.reservations,
    timezone: restaurant.timezone,
    exception: context.exception
  });

  const slot = availability.find((candidate) => sameInstant(candidate.startsAt, requestedStart));
  if (!slot) return { ok: false, error: "slot_unavailable" };

  const shift = context.shifts.find((candidate) => candidate.id === slot.shiftId);
  if (!shift) return { ok: false, error: "slot_unavailable" };

  const units = getCandidateUnitsForSlot(
    { date: input.date, partySize: input.partySize, zoneId: input.zoneId, serviceId: input.serviceId },
    context.units,
    context.reservations,
    slot.startsAt,
    shift.turnDurationMin,
    shift.bufferMin
  );

  if (!units.length) return { ok: false, error: "slot_unavailable" };

  const customerId = await ensureCustomer({
    restaurantId: restaurant.id,
    name: input.customer.name,
    email: input.customer.email,
    phone: input.customer.phone
  });

  const pool = getPool();
  const startsAt = slot.startsAt.toUTC().toISO();
  const endsAt = slot.endsAt.toUTC().toISO();
  const blockedUntil = slot.endsAt.plus({ minutes: shift.bufferMin }).toUTC().toISO();
  const lockKey = `${restaurant.id}:${customerId}:${startsAt}`;

  for (const unit of units) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [lockKey]);

      const existing = await client.query<{
        id: string;
        status: string;
        starts_at: Date;
        ends_at: Date;
        party_size: number;
        service_id: string | null;
        zone_id: string | null;
        seating_unit_id: string | null;
      }>(
        `SELECT id, status, starts_at, ends_at, party_size, service_id, zone_id, seating_unit_id
         FROM reservation
         WHERE restaurant_id = $1
           AND customer_id = $2
           AND starts_at = $3::timestamptz
           AND status NOT IN ('cancelled', 'no_show')
         LIMIT 1`,
        [restaurant.id, customerId, startsAt]
      );

      if (existing.rows[0]) {
        await client.query("COMMIT");
        const row = existing.rows[0];
        return {
          ok: true,
          reservation: {
            id: row.id,
            status: row.status,
            startsAt: DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(restaurant.timezone).toISO()!,
            endsAt: DateTime.fromJSDate(row.ends_at, { zone: "utc" }).setZone(restaurant.timezone).toISO()!,
            partySize: row.party_size,
            serviceId: row.service_id,
            zoneId: row.zone_id,
            seatingUnitId: row.seating_unit_id
          },
          dinerToken: createDinerToken({ type: "diner", customerId, reservationId: row.id })
        };
      }

      const reservationResult = await client.query<{
        id: string;
        status: string;
        starts_at: Date;
        ends_at: Date;
        party_size: number;
        service_id: string | null;
        zone_id: string | null;
        seating_unit_id: string | null;
      }>(
        `INSERT INTO reservation
           (restaurant_id, customer_id, service_id, seating_unit_id, zone_id,
            starts_at, ends_at, party_size, status, special_requests, source)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, 'confirmed', $9, $10)
         RETURNING id, status, starts_at, ends_at, party_size, service_id, zone_id, seating_unit_id`,
        [
          restaurant.id,
          customerId,
          input.serviceId ?? slot.serviceId,
          unit.id,
          input.zoneId ?? null,
          startsAt,
          endsAt,
          input.partySize,
          input.specialRequests ?? null,
          input.source
        ]
      );

      const reservation = reservationResult.rows[0];

      for (const mesaId of unit.mesaIds) {
        await client.query(
          `INSERT INTO reservation_mesa (reservation_id, mesa_id, periodo)
           VALUES ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'))`,
          [reservation.id, mesaId, startsAt, blockedUntil]
        );
      }

      await client.query("COMMIT");
      await scheduleReservationNotifications(reservation.id, restaurant.settings as Record<string, unknown>, slot.startsAt);

      return {
        ok: true,
        reservation: {
          id: reservation.id,
          status: reservation.status,
          startsAt: slot.startsAt.toISO()!,
          endsAt: slot.endsAt.toISO()!,
          partySize: reservation.party_size,
          serviceId: reservation.service_id,
          zoneId: reservation.zone_id,
          seatingUnitId: reservation.seating_unit_id
        },
        dinerToken: createDinerToken({ type: "diner", customerId, reservationId: reservation.id })
      };
    } catch (error) {
      await client.query("ROLLBACK");
      if ((error as { code?: string }).code === EXCLUSION_VIOLATION) {
        continue;
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return { ok: false, error: "slot_unavailable" };
}
