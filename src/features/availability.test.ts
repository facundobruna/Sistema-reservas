import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { computeAvailability, type ActiveReservation, type SeatingUnitConfig, type ShiftConfig } from "./availability";

const timezone = "America/Argentina/Buenos_Aires";
const date = "2026-05-30";

const baseShift: ShiftConfig = {
  id: "shift-1",
  serviceId: "service-1",
  zoneId: null,
  startTime: "20:00",
  endTime: "23:00",
  slotIntervalMin: 30,
  turnDurationMin: 90,
  seatingMode: "rolling",
  fixedTimes: null,
  pacingCap: null
};

const unit = (id: string, maxCapacity: number, mesaIds = [id], zoneIds = ["zone-1"]): SeatingUnitConfig => ({
  id,
  name: id,
  minCapacity: 1,
  maxCapacity,
  mesaIds,
  zoneIds,
  active: true
});

const at = (time: string) => {
  const [hour, minute] = time.split(":").map(Number);
  return DateTime.fromObject({ year: 2026, month: 5, day: 30, hour, minute }, { zone: timezone });
};

const reservation = (start: string, end: string, mesaIds: string[], partySize = 2): ActiveReservation => ({
  startsAt: at(start),
  endsAt: at(end),
  mesaIds,
  partySize
});

function run(overrides: {
  shifts?: ShiftConfig[];
  units?: SeatingUnitConfig[];
  reservations?: ActiveReservation[];
  partySize?: number;
  exception?: Parameters<typeof computeAvailability>[0]["exception"];
  zoneId?: string | null;
} = {}) {
  return computeAvailability({
    request: { date, partySize: overrides.partySize ?? 2, zoneId: overrides.zoneId },
    shifts: overrides.shifts ?? [baseShift],
    units: overrides.units ?? [unit("u2", 2)],
    reservations: overrides.reservations ?? [],
    timezone,
    exception: overrides.exception
  });
}

describe("computeAvailability", () => {
  it("returns no slots when the day is closed", () => {
    expect(run({ exception: { kind: "closed" } })).toEqual([]);
  });

  it("returns no slots when no seating unit can fit the party size", () => {
    expect(run({ partySize: 6, units: [unit("u2", 2), unit("u4", 4)] })).toEqual([]);
  });

  it("allows exact edge touching but rejects real overlap", () => {
    const slots = run({ reservations: [reservation("20:00", "21:30", ["u2"])] });
    expect(slots.map((slot) => slot.startsAt.toFormat("HH:mm"))).toEqual(["21:30"]);
  });

  it("blocks a slot by pacing even when a mesa is free", () => {
    const slots = run({
      shifts: [{ ...baseShift, pacingCap: 3 }],
      units: [unit("u2", 2), unit("u4", 4, ["m4"])],
      reservations: [reservation("20:00", "21:30", ["u2"], 2)]
    });
    expect(slots.map((slot) => slot.startsAt.toFormat("HH:mm"))).not.toContain("20:00");
  });

  it("chooses best-fit by smallest max capacity", () => {
    const [slot] = run({ partySize: 2, units: [unit("u8", 8), unit("u2", 2), unit("u4", 4)] });
    expect(slot.suggestedUnitId).toBe("u2");
  });

  it("supports combos that occupy multiple mesas", () => {
    const slots = run({
      partySize: 5,
      units: [unit("u2", 2, ["m1"]), unit("combo", 6, ["m1", "m2"])]
    });
    expect(slots[0]?.suggestedUnitId).toBe("combo");
  });

  it("supports fixed seating times inside the window", () => {
    const slots = run({
      shifts: [
        {
          ...baseShift,
          seatingMode: "fixed",
          fixedTimes: ["19:30", "20:00", "22:00", "22:30"]
        }
      ]
    });
    expect(slots.map((slot) => slot.startsAt.toFormat("HH:mm"))).toEqual(["20:00"]);
  });
});
