import { DateTime } from "luxon";
import { getPool } from "@/lib/db";

export type AnalyticsRange = {
  from: string;
  to: string;
  startUtc: string;
  endUtc: string;
  days: number;
  timezone: string;
};

type CountRow = {
  label: string;
  value: number;
  covers?: number;
};

type DailyRow = {
  date: string;
  reservations: number;
  covers: number;
  noShows: number;
  cancelled: number;
};

type PeakHourRow = {
  hour: number;
  label: string;
  reservations: number;
  covers: number;
};

type TopCustomerRow = {
  name: string;
  phone: string;
  reservations: number;
  covers: number;
  lastVisit: string | null;
};

type ShiftRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ExceptionRow = {
  date: string;
  kind: "closed" | "special_hours";
  start_time: string | null;
  end_time: string | null;
};

export type RestaurantAnalytics = {
  range: AnalyticsRange;
  totals: {
    reservations: number;
    activeReservations: number;
    covers: number;
    uniqueCustomers: number;
    noShows: number;
    cancellations: number;
    noShowRate: number;
    cancellationRate: number;
    occupancyRate: number;
    avgTurnMinutes: number;
  };
  occupancy: {
    seatCapacity: number;
    openHours: number;
    bookedCoverMinutes: number;
    availableCoverMinutes: number;
  };
  daily: DailyRow[];
  statusMix: CountRow[];
  sourceMix: CountRow[];
  customerMix: CountRow[];
  peakHours: PeakHourRow[];
  topZones: CountRow[];
  topServices: CountRow[];
  topCustomers: TopCustomerRow[];
};

export function resolveAnalyticsRange(input: {
  from?: string | null;
  to?: string | null;
  timezone: string;
}): AnalyticsRange {
  const today = DateTime.now().setZone(input.timezone).startOf("day");
  let to = parseLocalDate(input.to, input.timezone) ?? today;
  let from = parseLocalDate(input.from, input.timezone) ?? to.minus({ days: 29 });
  if (from > to) [from, to] = [to, from];

  const spanDays = Math.floor(to.diff(from, "days").days) + 1;
  if (spanDays > 120) {
    from = to.minus({ days: 119 });
  }

  const start = from.startOf("day");
  const endExclusive = to.plus({ days: 1 }).startOf("day");
  return {
    from: start.toISODate() ?? "",
    to: to.toISODate() ?? "",
    startUtc: start.toUTC().toISO() ?? "",
    endUtc: endExclusive.toUTC().toISO() ?? "",
    days: Math.floor(to.diff(start, "days").days) + 1,
    timezone: input.timezone
  };
}

export async function getRestaurantAnalytics(restaurantId: string, range: AnalyticsRange): Promise<RestaurantAnalytics> {
  const pool = getPool();
  const [
    totals,
    daily,
    statusMix,
    sourceMix,
    customerMix,
    peakHours,
    topZones,
    topServices,
    topCustomers,
    seatCapacity,
    shifts,
    exceptions,
    bookedCoverMinutes
  ] = await Promise.all([
    pool.query<{
      reservations: number;
      active_reservations: number;
      covers: number;
      unique_customers: number;
      no_shows: number;
      cancellations: number;
      avg_turn_minutes: string;
    }>(
      `SELECT count(*)::int AS reservations,
              count(*) FILTER (WHERE status NOT IN ('cancelled', 'no_show'))::int AS active_reservations,
              COALESCE(sum(party_size), 0)::int AS covers,
              count(DISTINCT customer_id)::int AS unique_customers,
              count(*) FILTER (WHERE status = 'no_show')::int AS no_shows,
              count(*) FILTER (WHERE status = 'cancelled')::int AS cancellations,
              COALESCE(avg(EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60)
                FILTER (WHERE status NOT IN ('cancelled', 'no_show')), 0)::numeric(10,2)::text AS avg_turn_minutes
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<DailyRow>(
      `SELECT to_char((starts_at AT TIME ZONE $4)::date, 'YYYY-MM-DD') AS date,
              count(*)::int AS reservations,
              COALESCE(sum(party_size), 0)::int AS covers,
              count(*) FILTER (WHERE status = 'no_show')::int AS "noShows",
              count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz
       GROUP BY 1
       ORDER BY 1`,
      [restaurantId, range.startUtc, range.endUtc, range.timezone]
    ),
    pool.query<CountRow>(
      `SELECT status::text AS label,
              count(*)::int AS value,
              COALESCE(sum(party_size), 0)::int AS covers
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz
       GROUP BY status
       ORDER BY value DESC`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<CountRow>(
      `SELECT source::text AS label,
              count(*)::int AS value,
              COALESCE(sum(party_size), 0)::int AS covers
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz
       GROUP BY source
       ORDER BY value DESC`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<CountRow>(
      `WITH scoped AS (
         SELECT r.id, r.customer_id,
                EXISTS (
                  SELECT 1
                  FROM reservation previous
                  WHERE previous.restaurant_id = r.restaurant_id
                    AND previous.customer_id = r.customer_id
                    AND previous.starts_at < $2::timestamptz
                ) AS returning_customer
         FROM reservation r
         WHERE r.restaurant_id = $1
           AND r.starts_at >= $2::timestamptz
           AND r.starts_at < $3::timestamptz
           AND r.status NOT IN ('cancelled', 'no_show')
       )
       SELECT CASE WHEN returning_customer THEN 'Recurrentes' ELSE 'Nuevos' END AS label,
              count(*)::int AS value
       FROM scoped
       GROUP BY returning_customer
       ORDER BY returning_customer DESC`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<PeakHourRow>(
      `SELECT EXTRACT(HOUR FROM starts_at AT TIME ZONE $4)::int AS hour,
              to_char(date_trunc('hour', starts_at AT TIME ZONE $4), 'HH24:00') AS label,
              count(*)::int AS reservations,
              COALESCE(sum(party_size), 0)::int AS covers
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz
         AND status NOT IN ('cancelled', 'no_show')
       GROUP BY 1, 2
       ORDER BY reservations DESC, hour
       LIMIT 8`,
      [restaurantId, range.startUtc, range.endUtc, range.timezone]
    ),
    pool.query<CountRow>(
      `SELECT COALESCE(z.name, 'Sin zona') AS label,
              count(*)::int AS value,
              COALESCE(sum(r.party_size), 0)::int AS covers
       FROM reservation r
       LEFT JOIN zone z ON z.id = r.zone_id AND z.restaurant_id = r.restaurant_id
       WHERE r.restaurant_id = $1
         AND r.starts_at >= $2::timestamptz
         AND r.starts_at < $3::timestamptz
         AND r.status NOT IN ('cancelled', 'no_show')
       GROUP BY 1
       ORDER BY value DESC
       LIMIT 6`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<CountRow>(
      `SELECT COALESCE(s.name, 'Sin servicio') AS label,
              count(*)::int AS value,
              COALESCE(sum(r.party_size), 0)::int AS covers
       FROM reservation r
       LEFT JOIN service s ON s.id = r.service_id AND s.restaurant_id = r.restaurant_id
       WHERE r.restaurant_id = $1
         AND r.starts_at >= $2::timestamptz
         AND r.starts_at < $3::timestamptz
         AND r.status NOT IN ('cancelled', 'no_show')
       GROUP BY 1
       ORDER BY value DESC
       LIMIT 6`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<TopCustomerRow>(
      `SELECT COALESCE(c.name, c.phone, 'Sin nombre') AS name,
              c.phone,
              count(*)::int AS reservations,
              COALESCE(sum(r.party_size), 0)::int AS covers,
              max(r.starts_at)::text AS "lastVisit"
       FROM reservation r
       JOIN customer c ON c.id = r.customer_id
       WHERE r.restaurant_id = $1
         AND r.starts_at >= $2::timestamptz
         AND r.starts_at < $3::timestamptz
         AND r.status NOT IN ('cancelled', 'no_show')
       GROUP BY c.id, c.name, c.phone
       ORDER BY reservations DESC, covers DESC, name
       LIMIT 5`,
      [restaurantId, range.startUtc, range.endUtc]
    ),
    pool.query<{ seat_capacity: number }>(
      "SELECT COALESCE(sum(max_capacity), 0)::int AS seat_capacity FROM mesa WHERE restaurant_id = $1 AND active",
      [restaurantId]
    ),
    pool.query<ShiftRow>(
      "SELECT day_of_week, start_time::text, end_time::text FROM shift WHERE restaurant_id = $1",
      [restaurantId]
    ),
    pool.query<ExceptionRow>(
      `SELECT date::text, kind::text AS kind, start_time::text, end_time::text
       FROM schedule_exception
       WHERE restaurant_id = $1
         AND date >= $2::date
         AND date <= $3::date`,
      [restaurantId, range.from, range.to]
    ),
    pool.query<{ booked_cover_minutes: string }>(
      `SELECT COALESCE(sum(party_size * EXTRACT(EPOCH FROM (ends_at - starts_at)) / 60), 0)::numeric(14,2)::text AS booked_cover_minutes
       FROM reservation
       WHERE restaurant_id = $1
         AND starts_at >= $2::timestamptz
         AND starts_at < $3::timestamptz
         AND status NOT IN ('cancelled', 'no_show')`,
      [restaurantId, range.startUtc, range.endUtc]
    )
  ]);

  const totalRow = totals.rows[0];
  const reservations = Number(totalRow?.reservations ?? 0);
  const noShows = Number(totalRow?.no_shows ?? 0);
  const cancellations = Number(totalRow?.cancellations ?? 0);
  const seats = Number(seatCapacity.rows[0]?.seat_capacity ?? 0);
  const openMinutes = computeOpenMinutes(range, shifts.rows, exceptions.rows);
  const availableCoverMinutes = seats * openMinutes;
  const bookedMinutes = Number(bookedCoverMinutes.rows[0]?.booked_cover_minutes ?? 0);

  return {
    range,
    totals: {
      reservations,
      activeReservations: Number(totalRow?.active_reservations ?? 0),
      covers: Number(totalRow?.covers ?? 0),
      uniqueCustomers: Number(totalRow?.unique_customers ?? 0),
      noShows,
      cancellations,
      noShowRate: percentage(noShows, reservations),
      cancellationRate: percentage(cancellations, reservations),
      occupancyRate: percentage(bookedMinutes, availableCoverMinutes),
      avgTurnMinutes: Math.round(Number(totalRow?.avg_turn_minutes ?? 0))
    },
    occupancy: {
      seatCapacity: seats,
      openHours: round(openMinutes / 60),
      bookedCoverMinutes: round(bookedMinutes),
      availableCoverMinutes: round(availableCoverMinutes)
    },
    daily: fillDailySeries(range, daily.rows),
    statusMix: statusMix.rows,
    sourceMix: sourceMix.rows,
    customerMix: customerMix.rows,
    peakHours: peakHours.rows,
    topZones: topZones.rows,
    topServices: topServices.rows,
    topCustomers: topCustomers.rows
  };
}

function parseLocalDate(value: string | null | undefined, timezone: string) {
  if (!value) return null;
  const parsed = DateTime.fromISO(value, { zone: timezone });
  return parsed.isValid ? parsed.startOf("day") : null;
}

function computeOpenMinutes(range: AnalyticsRange, shifts: ShiftRow[], exceptions: ExceptionRow[]) {
  const exceptionByDate = new Map(exceptions.map((exception) => [exception.date.slice(0, 10), exception]));
  let cursor = DateTime.fromISO(range.from, { zone: range.timezone }).startOf("day");
  const end = DateTime.fromISO(range.to, { zone: range.timezone }).startOf("day");
  let minutes = 0;

  while (cursor <= end) {
    const isoDate = cursor.toISODate() ?? "";
    const exception = exceptionByDate.get(isoDate);
    if (exception?.kind !== "closed") {
      if (exception?.kind === "special_hours" && exception.start_time && exception.end_time) {
        minutes += minutesBetween(exception.start_time, exception.end_time);
      } else {
        const dayOfWeek = cursor.weekday % 7;
        minutes += shifts
          .filter((shift) => shift.day_of_week === dayOfWeek)
          .reduce((sum, shift) => sum + minutesBetween(shift.start_time, shift.end_time), 0);
      }
    }
    cursor = cursor.plus({ days: 1 });
  }

  return minutes;
}

function minutesBetween(start: string, end: string) {
  const [startHour = 0, startMinute = 0] = start.split(":").map(Number);
  const [endHour = 0, endMinute = 0] = end.split(":").map(Number);
  return Math.max(0, endHour * 60 + endMinute - (startHour * 60 + startMinute));
}

function fillDailySeries(range: AnalyticsRange, rows: DailyRow[]) {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  const filled: DailyRow[] = [];
  let cursor = DateTime.fromISO(range.from, { zone: range.timezone }).startOf("day");
  const end = DateTime.fromISO(range.to, { zone: range.timezone }).startOf("day");
  while (cursor <= end) {
    const date = cursor.toISODate() ?? "";
    filled.push(byDate.get(date) ?? { date, reservations: 0, covers: 0, noShows: 0, cancelled: 0 });
    cursor = cursor.plus({ days: 1 });
  }
  return filled;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return round((value / total) * 100);
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
