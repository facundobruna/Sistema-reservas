// =============================================================
// Motor de disponibilidad
// Lógica pura (testeable) + camino de reserva con concurrencia.
// Requiere: luxon (manejo de timezone/DST) y pg (driver Postgres).
// =============================================================

import { DateTime } from 'luxon';
import type { Pool } from 'pg';

// ---------- Tipos de configuración (cargados desde la base) ----------

export interface SeatingUnit {
  id: string;
  minCapacity: number;
  maxCapacity: number;
  mesaIds: string[];      // mesas físicas que ocupa
  zoneId: string | null;
  active: boolean;
}

export interface ShiftConfig {
  startTime: string;        // "20:00" hora LOCAL del restaurante
  endTime: string;          // "23:30"
  slotIntervalMin: number;  // 15
  turnDurationMin: number;  // 90 — cuánto ocupa una sentada
  seatingMode: 'rolling' | 'fixed';
  fixedTimes?: string[];    // ["20:00","22:15"] si seatingMode='fixed'
  pacingCap: number | null; // cubiertos máx por ventana; null = sin tope (solo mesas)
  zoneId: string | null;    // null = aplica a todas las zonas
}

export interface ScheduleException {
  kind: 'closed' | 'special_hours';
  startTime?: string;
  endTime?: string;
}

// Reserva activa existente (no cancelada / no_show), con sus mesas ocupadas.
// Los instantes están en línea de tiempo absoluta (UTC); se comparan tal cual.
export interface ActiveReservation {
  startsAt: DateTime;
  endsAt: DateTime;
  partySize: number;
  mesaIds: string[];
}

export interface AvailabilityRequest {
  date: string;            // "2026-05-22" — fecha LOCAL del restaurante
  partySize: number;
  zoneId?: string | null;
}

export interface AvailableSlot {
  startsAt: DateTime;
  suggestedUnitId: string; // unidad best-fit para pre-asignar al confirmar
}

// ---------- Helpers ----------

function parseTime(t: string): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h, minute: m };
}

function localAt(date: string, time: string, tz: string): DateTime {
  const { hour, minute } = parseTime(time);
  const [year, month, day] = date.split('-').map(Number);
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: tz });
}

// ¿La mesa está libre en [slotStart, slotEnd) frente a las reservas dadas?
function mesaLibre(
  mesaId: string,
  slotStart: DateTime,
  slotEnd: DateTime,
  reservations: ActiveReservation[],
): boolean {
  for (const r of reservations) {
    if (!r.mesaIds.includes(mesaId)) continue;
    // solapamiento de rangos: start < r.end && r.start < end
    if (slotStart < r.endsAt && r.startsAt < slotEnd) return false;
  }
  return true;
}

// Mejor unidad libre que entra para party_size (best-fit: la más chica que sirve).
function elegirUnidad(
  units: SeatingUnit[],
  partySize: number,
  slotStart: DateTime,
  slotEnd: DateTime,
  reservations: ActiveReservation[],
): SeatingUnit | null {
  const candidatas = units
    .filter(u => u.active && partySize >= u.minCapacity && partySize <= u.maxCapacity)
    .sort((a, b) => a.maxCapacity - b.maxCapacity); // best-fit primero

  for (const u of candidatas) {
    const libre = u.mesaIds.every(m => mesaLibre(m, slotStart, slotEnd, reservations));
    if (libre) return u;
  }
  return null;
}

// Genera los horarios de inicio candidatos de un turno para una fecha.
function horariosCandidatos(
  shift: ShiftConfig,
  date: string,
  tz: string,
  override?: ScheduleException,
): DateTime[] {
  // Horario especial: reemplaza la ventana del turno.
  const startStr = override?.kind === 'special_hours' && override.startTime
    ? override.startTime : shift.startTime;
  const endStr = override?.kind === 'special_hours' && override.endTime
    ? override.endTime : shift.endTime;

  const windowStart = localAt(date, startStr, tz);
  const windowEnd = localAt(date, endStr, tz);
  // Última sentada posible: debe terminar dentro de la ventana.
  const lastSeating = windowEnd.minus({ minutes: shift.turnDurationMin });
  if (lastSeating < windowStart) return [];

  if (shift.seatingMode === 'fixed') {
    return (shift.fixedTimes ?? [])
      .map(t => localAt(date, t, tz))
      .filter(dt => dt >= windowStart && dt <= lastSeating);
  }

  const slots: DateTime[] = [];
  for (let dt = windowStart; dt <= lastSeating; dt = dt.plus({ minutes: shift.slotIntervalMin })) {
    slots.push(dt);
  }
  return slots;
}

// ---------- Cálculo de disponibilidad (lógica pura) ----------

export function computeAvailability(
  req: AvailabilityRequest,
  shifts: ShiftConfig[],
  units: SeatingUnit[],
  reservations: ActiveReservation[],
  tz: string,
  exception?: ScheduleException,
): AvailableSlot[] {
  if (exception?.kind === 'closed') return [];

  // Unidades que entran para el grupo (y la zona pedida, si se especificó).
  const unidades = units.filter(u =>
    (!req.zoneId || u.zoneId === null || u.zoneId === req.zoneId),
  );

  const resultado: AvailableSlot[] = [];
  const vistos = new Set<string>(); // dedup por instante

  for (const shift of shifts) {
    if (req.zoneId && shift.zoneId && shift.zoneId !== req.zoneId) continue;

    for (const start of horariosCandidatos(shift, req.date, tz, exception)) {
      const slotEnd = start.plus({ minutes: shift.turnDurationMin });

      // Capa 1 — pacing: cubiertos que ARRANCAN en la ventana del slot.
      if (shift.pacingCap !== null) {
        const ventanaFin = start.plus({ minutes: shift.slotIntervalMin });
        const cubiertos = reservations
          .filter(r => r.startsAt >= start && r.startsAt < ventanaFin)
          .reduce((acc, r) => acc + r.partySize, 0);
        if (cubiertos + req.partySize > shift.pacingCap) continue;
      }

      // Capa 2 — mesa: tiene que existir una unidad libre que entre.
      const unidad = elegirUnidad(unidades, req.partySize, start, slotEnd, reservations);
      if (!unidad) continue;

      const key = start.toISO()!;
      if (vistos.has(key)) continue;
      vistos.add(key);
      resultado.push({ startsAt: start, suggestedUnitId: unidad.id });
    }
  }

  return resultado.sort((a, b) => a.startsAt.toMillis() - b.startsAt.toMillis());
}

// ---------- Reserva: camino crítico de concurrencia ----------
// El constraint sin_solape (EXCLUDE en reservation_mesa) es la última línea
// de defensa. Si dos requests pelean la última mesa, una transacción falla
// con el código 23P01 (exclusion_violation) y reintentamos con otra unidad.

const EXCLUSION_VIOLATION = '23P01';

export async function bookReservation(
  pool: Pool,
  params: {
    restaurantId: string;
    customerId: string;
    serviceId: string | null;
    zoneId: string | null;
    startsAt: DateTime;
    turnDurationMin: number;
    partySize: number;
    specialRequests?: string;
    source: 'web' | 'whatsapp' | 'manual';
  },
  // Unidades candidatas ya ordenadas por best-fit (de computeAvailability/elegirUnidad).
  unidadesCandidatas: SeatingUnit[],
): Promise<{ reservationId: string; seatingUnitId: string } | { error: 'sin_disponibilidad' }> {
  const startsAt = params.startsAt.toUTC().toISO();
  const endsAt = params.startsAt.plus({ minutes: params.turnDurationMin }).toUTC().toISO();
  const periodo = `[${startsAt},${endsAt})`; // tstzrange '[)'

  for (const unidad of unidadesCandidatas) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO reservation
           (restaurant_id, customer_id, service_id, seating_unit_id, zone_id,
            starts_at, ends_at, party_size, status, special_requests, source)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'confirmed',$9,$10)
         RETURNING id`,
        [params.restaurantId, params.customerId, params.serviceId, unidad.id,
         params.zoneId, startsAt, endsAt, params.partySize,
         params.specialRequests ?? null, params.source],
      );
      const reservationId = rows[0].id as string;

      // Una fila por mesa física de la unidad; el EXCLUDE valida el solape.
      for (const mesaId of unidad.mesaIds) {
        await client.query(
          `INSERT INTO reservation_mesa (reservation_id, mesa_id, periodo)
           VALUES ($1, $2, $3::tstzrange)`,
          [reservationId, mesaId, periodo],
        );
      }

      await client.query('COMMIT');
      return { reservationId, seatingUnitId: unidad.id };
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      // Si fue solape, la unidad se ocupó recién: probamos la siguiente.
      if ((err as { code?: string }).code === EXCLUSION_VIOLATION) continue;
      throw err;
    } finally {
      client.release();
    }
  }

  return { error: 'sin_disponibilidad' };
}
