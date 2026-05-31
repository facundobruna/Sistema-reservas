import { DateTime } from "luxon";

export type SeatingMode = "rolling" | "fixed";

export type SeatingUnitConfig = {
  id: string;
  name: string;
  minCapacity: number;
  maxCapacity: number;
  mesaIds: string[];
  zoneIds: string[];
  active: boolean;
};

export type ShiftConfig = {
  id: string;
  serviceId: string;
  zoneId: string | null;
  startTime: string;
  endTime: string;
  slotIntervalMin: number;
  turnDurationMin: number;
  bufferMin: number;
  seatingMode: SeatingMode;
  fixedTimes: string[] | null;
  pacingCap: number | null;
  overbookingPct: number;
};

export type ScheduleExceptionConfig = {
  kind: "closed" | "special_hours";
  startTime?: string | null;
  endTime?: string | null;
};

export type ActiveReservation = {
  id?: string;
  startsAt: DateTime;
  endsAt: DateTime;
  blockedUntil?: DateTime;
  partySize: number;
  mesaIds: string[];
};

export type AvailabilityRequest = {
  date: string;
  partySize: number;
  zoneId?: string | null;
  serviceId?: string | null;
};

export type AvailableSlot = {
  startsAt: DateTime;
  endsAt: DateTime;
  serviceId: string;
  shiftId: string;
  suggestedUnitId: string;
};

export type AvailabilityInput = {
  request: AvailabilityRequest;
  shifts: ShiftConfig[];
  units: SeatingUnitConfig[];
  reservations: ActiveReservation[];
  timezone: string;
  exception?: ScheduleExceptionConfig | null;
};

function parseTime(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return { hour: Number(hour), minute: Number(minute) };
}

function timeMinutes(value: string) {
  const { hour, minute } = parseTime(value);
  return hour * 60 + minute;
}

export function localDateTime(date: string, time: string, timezone: string) {
  const { hour, minute } = parseTime(time);
  const [year, month, day] = date.split("-").map(Number);
  return DateTime.fromObject({ year, month, day, hour, minute }, { zone: timezone });
}

function later(left: DateTime, right: DateTime) {
  return left.toMillis() >= right.toMillis() ? left : right;
}

function rangesOverlap(start: DateTime, end: DateTime, reservation: ActiveReservation, bufferMin: number) {
  const candidateBlockedEnd = end.plus({ minutes: bufferMin });
  const reservationBufferedEnd = reservation.endsAt.plus({ minutes: bufferMin });
  const reservationBlockedEnd = reservation.blockedUntil
    ? later(reservation.blockedUntil, reservationBufferedEnd)
    : reservationBufferedEnd;
  return start.toMillis() < reservationBlockedEnd.toMillis() && reservation.startsAt.toMillis() < candidateBlockedEnd.toMillis();
}

function unitMatchesRequest(unit: SeatingUnitConfig, request: AvailabilityRequest) {
  if (!unit.active) return false;
  if (request.partySize < unit.minCapacity || request.partySize > unit.maxCapacity) return false;
  if (request.zoneId && !unit.zoneIds.includes(request.zoneId)) return false;
  return true;
}

function unitIsFree(
  unit: SeatingUnitConfig,
  start: DateTime,
  end: DateTime,
  reservations: ActiveReservation[],
  bufferMin: number
) {
  return unit.mesaIds.every((mesaId) =>
    reservations.every((reservation) => !reservation.mesaIds.includes(mesaId) || !rangesOverlap(start, end, reservation, bufferMin))
  );
}

function candidateStarts(shift: ShiftConfig, date: string, timezone: string, exception?: ScheduleExceptionConfig | null) {
  const startTime =
    exception?.kind === "special_hours" && exception.startTime ? exception.startTime : shift.startTime;
  const endTime = exception?.kind === "special_hours" && exception.endTime ? exception.endTime : shift.endTime;
  const windowStart = localDateTime(date, startTime, timezone);
  let windowEnd = localDateTime(date, endTime, timezone);
  if (windowEnd.toMillis() <= windowStart.toMillis()) {
    windowEnd = windowEnd.plus({ days: 1 });
  }
  const lastStart = windowEnd.minus({ minutes: shift.turnDurationMin });

  if (lastStart.toMillis() < windowStart.toMillis()) return [];

  if (shift.seatingMode === "fixed") {
    return (shift.fixedTimes ?? [])
      .map((time) => {
        const fixedStart = localDateTime(date, time, timezone);
        return timeMinutes(time) < timeMinutes(startTime) ? fixedStart.plus({ days: 1 }) : fixedStart;
      })
      .filter((start) => start.toMillis() >= windowStart.toMillis() && start.toMillis() <= lastStart.toMillis());
  }

  const starts: DateTime[] = [];
  for (let cursor = windowStart; cursor.toMillis() <= lastStart.toMillis(); cursor = cursor.plus({ minutes: shift.slotIntervalMin })) {
    starts.push(cursor);
  }
  return starts;
}

function passesPacing(
  start: DateTime,
  partySize: number,
  slotIntervalMin: number,
  pacingCap: number | null,
  overbookingPct: number,
  reservations: ActiveReservation[]
) {
  if (pacingCap === null) return true;
  const effectivePacingCap = Math.ceil(pacingCap * (1 + Math.max(0, overbookingPct) / 100));
  const windowEnd = start.plus({ minutes: slotIntervalMin });
  const seated = reservations
    .filter(
      (reservation) =>
        reservation.startsAt.toMillis() >= start.toMillis() && reservation.startsAt.toMillis() < windowEnd.toMillis()
    )
    .reduce((sum, reservation) => sum + reservation.partySize, 0);

  return seated + partySize <= effectivePacingCap;
}

export function getCandidateUnitsForSlot(
  request: AvailabilityRequest,
  units: SeatingUnitConfig[],
  reservations: ActiveReservation[],
  start: DateTime,
  durationMinutes: number,
  bufferMin = 0
) {
  const end = start.plus({ minutes: durationMinutes });
  return units
    .filter((unit) => unitMatchesRequest(unit, request))
    .sort((left, right) => left.maxCapacity - right.maxCapacity || left.minCapacity - right.minCapacity)
    .filter((unit) => unitIsFree(unit, start, end, reservations, bufferMin));
}

export function computeAvailability(input: AvailabilityInput): AvailableSlot[] {
  const { request, shifts, units, reservations, timezone, exception } = input;
  if (exception?.kind === "closed") return [];

  const slots: AvailableSlot[] = [];
  const seen = new Set<string>();

  for (const shift of shifts) {
    if (request.serviceId && shift.serviceId !== request.serviceId) continue;
    if (request.zoneId && shift.zoneId && shift.zoneId !== request.zoneId) continue;

    for (const startsAt of candidateStarts(shift, request.date, timezone, exception)) {
      if (!passesPacing(startsAt, request.partySize, shift.slotIntervalMin, shift.pacingCap, shift.overbookingPct ?? 0, reservations)) {
        continue;
      }

      const candidates = getCandidateUnitsForSlot(request, units, reservations, startsAt, shift.turnDurationMin, shift.bufferMin ?? 0);
      const bestFit = candidates[0];
      if (!bestFit) continue;

      const key = startsAt.toUTC().toISO() ?? startsAt.toISO();
      if (!key || seen.has(key)) continue;
      seen.add(key);

      slots.push({
        startsAt,
        endsAt: startsAt.plus({ minutes: shift.turnDurationMin }),
        serviceId: shift.serviceId,
        shiftId: shift.id,
        suggestedUnitId: bestFit.id
      });
    }
  }

  return slots.sort((left, right) => left.startsAt.toMillis() - right.startsAt.toMillis());
}
