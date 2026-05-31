import { DateTime } from "luxon";
import { getDinerSession } from "@/lib/auth";
import { getPool } from "@/lib/db";

export type DinerReservationDetails = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  special_requests: string | null;
  restaurant_name: string;
  slug: string;
  timezone: string;
  service_name: string | null;
  zone_name: string | null;
};

export async function canAccessDinerReservation(request: Request, id: string) {
  const session = await getDinerSession(request);
  if (!session) return false;
  if (session.reservationId === id) return true;
  const result = await getPool().query("SELECT 1 FROM reservation WHERE id = $1 AND customer_id = $2", [
    id,
    session.customerId
  ]);
  return Boolean(result.rowCount);
}

export async function getDinerReservation(slug: string, id: string): Promise<DinerReservationDetails | null> {
  const result = await getPool().query<{
    id: string;
    status: string;
    starts_at: Date;
    ends_at: Date;
    party_size: number;
    special_requests: string | null;
    restaurant_name: string;
    slug: string;
    timezone: string;
    service_name: string | null;
    zone_name: string | null;
  }>(
    `SELECT r.id, r.status, r.starts_at, r.ends_at, r.party_size, r.special_requests,
            rest.name AS restaurant_name, rest.slug, rest.timezone,
            s.name AS service_name, z.name AS zone_name
     FROM reservation r
     JOIN restaurant rest ON rest.id = r.restaurant_id
     LEFT JOIN service s ON s.id = r.service_id
     LEFT JOIN zone z ON z.id = r.zone_id
     WHERE rest.slug = $1 AND r.id = $2`,
    [slug, id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    ...row,
    starts_at: DateTime.fromJSDate(row.starts_at, { zone: "utc" }).setZone(row.timezone).toISO()!,
    ends_at: DateTime.fromJSDate(row.ends_at, { zone: "utc" }).setZone(row.timezone).toISO()!
  };
}

function formatIcsDate(value: string) {
  return DateTime.fromISO(value).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function buildReservationIcs(reservation: DinerReservationDetails) {
  const summary = `Reserva en ${reservation.restaurant_name}`;
  const description = [
    `Reserva para ${reservation.party_size} personas.`,
    reservation.service_name ? `Servicio: ${reservation.service_name}.` : null,
    reservation.zone_name ? `Zona: ${reservation.zone_name}.` : null,
    reservation.special_requests ? `Pedidos: ${reservation.special_requests}` : null
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mesa Clara//Reservas//ES",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${reservation.id}@mesa-clara`,
    `DTSTAMP:${DateTime.now().toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'")}`,
    `DTSTART:${formatIcsDate(reservation.starts_at)}`,
    `DTEND:${formatIcsDate(reservation.ends_at)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(reservation.restaurant_name)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return `${lines.join("\r\n")}\r\n`;
}
