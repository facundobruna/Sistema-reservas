import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string }>({
  dataType() {
    return "citext";
  }
});

const tstzrange = customType<{ data: string }>({
  dataType() {
    return "tstzrange";
  }
});

export const staffRole = pgEnum("staff_role", ["owner", "manager", "host"]);
export const seatingKind = pgEnum("seating_kind", ["single", "combo"]);
export const seatingMode = pgEnum("seating_mode", ["rolling", "fixed"]);
export const exceptionKind = pgEnum("exception_kind", ["closed", "special_hours"]);
export const reservationStatus = pgEnum("reservation_status", [
  "pending",
  "confirmed",
  "seated",
  "completed",
  "cancelled",
  "no_show"
]);
export const reservationSource = pgEnum("reservation_source", ["web", "whatsapp", "manual"]);
export const notificationType = pgEnum("notification_type", ["confirmation", "reminder"]);
export const notificationChannel = pgEnum("notification_channel", ["email", "whatsapp"]);
export const notificationStatus = pgEnum("notification_status", ["scheduled", "sent", "failed"]);

export const restaurant = pgTable("restaurant", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
  settings: jsonb("settings").notNull().default(sql`'{}'::jsonb`),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  suspendedReason: text("suspended_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const staffUser = pgTable(
  "staff_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    email: citext("email").notNull(),
    name: text("name").notNull(),
    role: staffRole("role").notNull().default("host"),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("staff_user_restaurant_email_key").on(t.restaurantId, t.email),
    index("idx_staff_restaurant").on(t.restaurantId),
    index("idx_staff_email").on(t.email)
  ]
);

export const zone = pgTable(
  "zone",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_zone_restaurant").on(t.restaurantId)]
);

export const mesa = pgTable(
  "mesa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id")
      .notNull()
      .references(() => zone.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minCapacity: integer("min_capacity").notNull().default(1),
    maxCapacity: integer("max_capacity").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_mesa_restaurant").on(t.restaurantId),
    index("idx_mesa_zone").on(t.zoneId),
    check("mesa_cap_chk", sql`${t.maxCapacity} >= ${t.minCapacity}`)
  ]
);

export const seatingUnit = pgTable(
  "seating_unit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: seatingKind("kind").notNull().default("single"),
    minCapacity: integer("min_capacity").notNull(),
    maxCapacity: integer("max_capacity").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_seating_unit_restaurant").on(t.restaurantId),
    check("seating_unit_cap_chk", sql`${t.maxCapacity} >= ${t.minCapacity}`)
  ]
);

export const seatingUnitMesa = pgTable(
  "seating_unit_mesa",
  {
    seatingUnitId: uuid("seating_unit_id")
      .notNull()
      .references(() => seatingUnit.id, { onDelete: "cascade" }),
    mesaId: uuid("mesa_id")
      .notNull()
      .references(() => mesa.id, { onDelete: "cascade" })
  },
  (t) => [primaryKey({ columns: [t.seatingUnitId, t.mesaId] }), index("idx_sum_mesa").on(t.mesaId)]
);

export const service = pgTable(
  "service",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_service_restaurant").on(t.restaurantId)]
);

export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => service.id, { onDelete: "cascade" }),
    zoneId: uuid("zone_id").references(() => zone.id, { onDelete: "cascade" }),
    dayOfWeek: smallint("day_of_week").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    slotIntervalMin: integer("slot_interval_min").notNull().default(15),
    turnDurationMin: integer("turn_duration_min").notNull().default(90),
    seatingMode: seatingMode("seating_mode").notNull().default("rolling"),
    fixedTimes: time("fixed_times").array(),
    pacingCap: integer("pacing_cap"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_shift_lookup").on(t.restaurantId, t.serviceId, t.dayOfWeek),
    index("idx_shift_zone").on(t.zoneId),
    check("shift_dow_chk", sql`${t.dayOfWeek} BETWEEN 0 AND 6`),
    check("shift_time_chk", sql`${t.endTime} > ${t.startTime}`)
  ]
);

export const scheduleException = pgTable(
  "schedule_exception",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: exceptionKind("kind").notNull(),
    startTime: time("start_time"),
    endTime: time("end_time"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index("idx_exception_lookup").on(t.restaurantId, t.date)]
);

export const customer = pgTable("customer", {
  id: uuid("id").primaryKey().defaultRandom(),
  phone: text("phone").notNull().unique(),
  email: citext("email"),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const customerRestaurant = pgTable(
  "customer_restaurant",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    notes: text("notes"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    noShowCount: integer("no_show_count").notNull().default(0),
    visitCount: integer("visit_count").notNull().default(0),
    vip: boolean("vip").notNull().default(false)
  },
  (t) => [
    primaryKey({ columns: [t.restaurantId, t.customerId] }),
    index("idx_customer_restaurant_customer").on(t.customerId)
  ]
);

export const reservation = pgTable(
  "reservation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").references(() => service.id, { onDelete: "set null" }),
    seatingUnitId: uuid("seating_unit_id").references(() => seatingUnit.id, { onDelete: "set null" }),
    zoneId: uuid("zone_id").references(() => zone.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    partySize: integer("party_size").notNull(),
    status: reservationStatus("status").notNull().default("pending"),
    specialRequests: text("special_requests"),
    source: reservationSource("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_reservation_day").on(t.restaurantId, t.startsAt),
    index("idx_reservation_status").on(t.restaurantId, t.status),
    index("idx_reservation_customer").on(t.customerId),
    index("idx_reservation_service").on(t.serviceId),
    index("idx_reservation_zone").on(t.zoneId),
    check("reservation_time_chk", sql`${t.endsAt} > ${t.startsAt}`),
    check("reservation_party_chk", sql`${t.partySize} > 0`)
  ]
);

export const reservationMesa = pgTable(
  "reservation_mesa",
  {
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    mesaId: uuid("mesa_id")
      .notNull()
      .references(() => mesa.id, { onDelete: "cascade" }),
    periodo: tstzrange("periodo").notNull()
  },
  (t) => [primaryKey({ columns: [t.reservationId, t.mesaId] }), index("idx_reservation_mesa_mesa").on(t.mesaId)]
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reservationId: uuid("reservation_id")
      .notNull()
      .references(() => reservation.id, { onDelete: "cascade" }),
    type: notificationType("type").notNull(),
    channel: notificationChannel("channel").notNull(),
    status: notificationStatus("status").notNull().default("scheduled"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    providerMessageId: text("provider_message_id"),
    lastError: text("last_error"),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_notification_reservation").on(t.reservationId),
    index("idx_notification_due").on(t.scheduledFor).where(sql`${t.status} = 'scheduled'`)
  ]
);

export const waitlistEntry = pgTable(
  "waitlist_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => service.id, { onDelete: "set null" }),
    zoneId: uuid("zone_id").references(() => zone.id, { onDelete: "set null" }),
    date: date("date").notNull(),
    partySize: integer("party_size").notNull(),
    preferredTime: time("preferred_time"),
    status: text("status").notNull().default("open"),
    specialRequests: text("special_requests"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_waitlist_restaurant_date").on(t.restaurantId, t.date, t.status),
    index("idx_waitlist_customer").on(t.customerId, t.createdAt),
    check("waitlist_party_chk", sql`${t.partySize} > 0`),
    check("waitlist_status_chk", sql`${t.status} IN ('open', 'notified', 'booked', 'cancelled')`)
  ]
);

export const billingSubscription = pgTable(
  "billing_subscription",
  {
    restaurantId: uuid("restaurant_id")
      .primaryKey()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    planKey: text("plan_key").notNull().default("growth"),
    status: text("status").notNull().default("trialing"),
    mercadoPagoPayerId: text("mercadopago_payer_id"),
    mercadoPagoPreapprovalId: text("mercadopago_preapproval_id"),
    mercadoPagoPlanId: text("mercadopago_plan_id"),
    mercadoPagoPayerEmail: text("mercadopago_payer_email"),
    mercadoPagoInitPoint: text("mercadopago_init_point"),
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    nextPaymentAt: timestamp("next_payment_at", { withTimezone: true }),
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    monthlyReservationLimit: integer("monthly_reservation_limit").notNull().default(1200),
    mesaLimit: integer("mesa_limit").notNull().default(40),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    uniqueIndex("billing_subscription_preapproval_key")
      .on(t.mercadoPagoPreapprovalId)
      .where(sql`${t.mercadoPagoPreapprovalId} IS NOT NULL`),
    index("idx_billing_subscription_status").on(t.status, t.planKey),
    check("billing_plan_chk", sql`${t.planKey} IN ('starter', 'growth', 'scale')`),
    check(
      "billing_status_chk",
      sql`${t.status} IN ('trialing', 'pending', 'authorized', 'active', 'paused', 'canceled', 'cancelled', 'inactive', 'finished', 'expired')`
    )
  ]
);

export const mercadoPagoWebhookEvent = pgTable("mercadopago_webhook_event", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const superAdminUser = pgTable(
  "super_admin_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: citext("email").notNull().unique(),
    name: text("name").notNull(),
    role: text("role").notNull().default("owner"),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true })
  },
  (t) => [check("super_admin_role_chk", sql`${t.role} IN ('owner', 'support')`)]
);

export const restaurantFeatureFlag = pgTable(
  "restaurant_feature_flag",
  {
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurant.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid("updated_by").references(() => superAdminUser.id, { onDelete: "set null" })
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.key] }), index("idx_feature_flag_key").on(t.key, t.enabled)]
);

export const superAdminAuditLog = pgTable(
  "super_admin_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    superAdminId: uuid("super_admin_id").references(() => superAdminUser.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    restaurantId: uuid("restaurant_id").references(() => restaurant.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index("idx_super_admin_audit_restaurant").on(t.restaurantId, t.createdAt),
    index("idx_super_admin_audit_admin").on(t.superAdminId, t.createdAt)
  ]
);

export type Restaurant = typeof restaurant.$inferSelect;
export type Zone = typeof zone.$inferSelect;
export type Mesa = typeof mesa.$inferSelect;
export type SeatingUnit = typeof seatingUnit.$inferSelect;
export type Service = typeof service.$inferSelect;
export type Shift = typeof shift.$inferSelect;
export type Reservation = typeof reservation.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type WaitlistEntry = typeof waitlistEntry.$inferSelect;
export type BillingSubscription = typeof billingSubscription.$inferSelect;
export type SuperAdminUser = typeof superAdminUser.$inferSelect;
