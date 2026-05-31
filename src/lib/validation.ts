import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
export const phoneSchema = z.string().min(7).max(32);

export const publicReservationSchema = z.object({
  date: dateSchema,
  time: z.string().datetime({ offset: true }),
  partySize: z.coerce.number().int().positive().max(30),
  zoneId: uuidSchema.optional().nullable(),
  serviceId: uuidSchema.optional().nullable(),
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().optional().nullable(),
    phone: phoneSchema
  }),
  specialRequests: z.string().max(500).optional().nullable()
});

export const waitlistEntrySchema = z.object({
  date: dateSchema,
  partySize: z.coerce.number().int().positive().max(30),
  zoneId: uuidSchema.optional().nullable(),
  serviceId: uuidSchema.optional().nullable(),
  preferredTime: timeSchema.optional().nullable(),
  customer: z.object({
    name: z.string().min(1).max(120),
    email: z.string().email().optional().nullable(),
    phone: phoneSchema
  }),
  specialRequests: z.string().max(500).optional().nullable()
});

export const waitlistPatchSchema = z.object({
  status: z.enum(["open", "notified", "booked", "cancelled"])
});

export const zoneBodySchema = z.object({
  name: z.string().min(1).max(80),
  position: z.coerce.number().int().default(0)
});

export const mesaBodySchema = z.object({
  zoneId: uuidSchema,
  name: z.string().min(1).max(80),
  minCapacity: z.coerce.number().int().positive().default(1),
  maxCapacity: z.coerce.number().int().positive(),
  active: z.boolean().optional().default(true)
});

export const seatingUnitBodySchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["single", "combo"]).default("combo"),
  minCapacity: z.coerce.number().int().positive(),
  maxCapacity: z.coerce.number().int().positive(),
  mesaIds: z.array(uuidSchema).min(1),
  active: z.boolean().optional().default(true)
});

export const serviceBodySchema = z.object({
  name: z.string().min(1).max(80),
  position: z.coerce.number().int().default(0)
});

const shiftBaseSchema = z.object({
  serviceId: uuidSchema,
  zoneId: uuidSchema.optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  slotIntervalMin: z.coerce.number().int().positive().default(15),
  turnDurationMin: z.coerce.number().int().positive().default(90),
  bufferMin: z.coerce.number().int().min(0).max(180).default(0),
  seatingMode: z.enum(["rolling", "fixed"]).default("rolling"),
  fixedTimes: z.array(timeSchema).optional().nullable(),
  pacingCap: z.coerce.number().int().positive().optional().nullable(),
  overbookingPct: z.coerce.number().int().min(0).max(100).default(0)
});

export const shiftBodySchema = shiftBaseSchema.refine((value) => value.startTime !== value.endTime, {
  message: "Shift start and end times must be different",
  path: ["endTime"]
});

export const shiftPatchSchema = shiftBaseSchema.partial().refine(
  (value) => !value.startTime || !value.endTime || value.startTime !== value.endTime,
  {
    message: "Shift start and end times must be different",
    path: ["endTime"]
  }
);

export const exceptionBodySchema = z.object({
  date: dateSchema,
  kind: z.enum(["closed", "special_hours"]),
  startTime: timeSchema.optional().nullable(),
  endTime: timeSchema.optional().nullable(),
  note: z.string().max(200).optional().nullable()
});

export const settingsBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).optional(),
  settings: z.record(z.string(), z.unknown()).optional()
});

export const reservationPatchSchema = z.object({
  specialRequests: z.string().max(500).optional().nullable(),
  status: z.enum(["pending", "confirmed", "seated", "completed", "cancelled", "no_show"]).optional()
});

export const adminReservationSchema = publicReservationSchema.extend({
  customer: publicReservationSchema.shape.customer.extend({
    email: z.string().email().optional().nullable()
  }),
  source: z.literal("manual").default("manual")
});

export const customerPatchSchema = z.object({
  notes: z.string().max(1000).optional().nullable(),
  tags: z.array(z.string().max(40)).optional(),
  vip: z.boolean().optional()
});
