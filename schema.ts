// =============================================================
// Esquema Drizzle ORM — mapea schema.sql
// El EXCLUDE constraint y las extensiones van en una migración SQL
// aparte (Drizzle no expresa exclusion constraints). Ver el final.
// =============================================================

import { sql } from 'drizzle-orm';
import {
  pgTable, pgEnum, uuid, text, integer, smallint, boolean,
  timestamp, jsonb, time, date, primaryKey, index, uniqueIndex,
  customType, check,
} from 'drizzle-orm/pg-core';

// ---------- Tipos custom (propios de Postgres) ----------

const tstzrange = customType<{ data: string }>({
  dataType() { return 'tstzrange'; },
});

const citext = customType<{ data: string }>({
  dataType() { return 'citext'; },
});

// ---------- Enums ----------

export const staffRole = pgEnum('staff_role', ['owner', 'manager', 'host']);
export const seatingKind = pgEnum('seating_kind', ['single', 'combo']);
export const seatingMode = pgEnum('seating_mode', ['rolling', 'fixed']);
export const exceptionKind = pgEnum('exception_kind', ['closed', 'special_hours']);
export const reservationStatus = pgEnum('reservation_status',
  ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']);
export const reservationSource = pgEnum('reservation_source', ['web', 'whatsapp', 'manual']);
export const notificationType = pgEnum('notification_type', ['confirmation', 'reminder']);
export const notificationChannel = pgEnum('notification_channel', ['email', 'whatsapp']);
export const notificationStatus = pgEnum('notification_status', ['scheduled', 'sent', 'failed']);

// ---------- Tenant ----------

export const restaurant = pgTable('restaurant', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('America/Argentina/Buenos_Aires'),
  settings: jsonb('settings').notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Staff ----------

export const staffUser = pgTable('staff_user', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  email: citext('email').notNull(),
  name: text('name').notNull(),
  role: staffRole('role').notNull().default('host'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('staff_user_restaurant_email_key').on(t.restaurantId, t.email),
  index('idx_staff_restaurant').on(t.restaurantId),
]);

// ---------- Salón ----------

export const zone = pgTable('zone', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_zone_restaurant').on(t.restaurantId)]);

export const mesa = pgTable('mesa', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  zoneId: uuid('zone_id').notNull().references(() => zone.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  minCapacity: integer('min_capacity').notNull().default(1),
  maxCapacity: integer('max_capacity').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_mesa_restaurant').on(t.restaurantId),
  index('idx_mesa_zone').on(t.zoneId),
  check('mesa_cap_chk', sql`${t.maxCapacity} >= ${t.minCapacity}`),
]);

// ---------- Unidades reservables ----------

export const seatingUnit = pgTable('seating_unit', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  kind: seatingKind('kind').notNull().default('single'),
  minCapacity: integer('min_capacity').notNull(),
  maxCapacity: integer('max_capacity').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_seating_unit_restaurant').on(t.restaurantId),
  check('seating_unit_cap_chk', sql`${t.maxCapacity} >= ${t.minCapacity}`),
]);

export const seatingUnitMesa = pgTable('seating_unit_mesa', {
  seatingUnitId: uuid('seating_unit_id').notNull().references(() => seatingUnit.id, { onDelete: 'cascade' }),
  mesaId: uuid('mesa_id').notNull().references(() => mesa.id, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.seatingUnitId, t.mesaId] }),
  index('idx_sum_mesa').on(t.mesaId),
]);

// ---------- Servicios y turnos ----------

export const service = pgTable('service', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_service_restaurant').on(t.restaurantId)]);

export const shift = pgTable('shift', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  serviceId: uuid('service_id').notNull().references(() => service.id, { onDelete: 'cascade' }),
  zoneId: uuid('zone_id').references(() => zone.id, { onDelete: 'cascade' }),
  dayOfWeek: smallint('day_of_week').notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  slotIntervalMin: integer('slot_interval_min').notNull().default(15),
  turnDurationMin: integer('turn_duration_min').notNull().default(90),
  seatingMode: seatingMode('seating_mode').notNull().default('rolling'),
  fixedTimes: time('fixed_times').array(),
  pacingCap: integer('pacing_cap'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_shift_lookup').on(t.restaurantId, t.serviceId, t.dayOfWeek),
  check('shift_dow_chk', sql`${t.dayOfWeek} between 0 and 6`),
  check('shift_time_chk', sql`${t.endTime} > ${t.startTime}`),
]);

export const scheduleException = pgTable('schedule_exception', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  kind: exceptionKind('kind').notNull(),
  startTime: time('start_time'),
  endTime: time('end_time'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('idx_exception_lookup').on(t.restaurantId, t.date)]);

// ---------- Clientes ----------

export const customer = pgTable('customer', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull().unique(),
  email: citext('email'),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const customerRestaurant = pgTable('customer_restaurant', {
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'cascade' }),
  notes: text('notes'),
  tags: text('tags').array().notNull().default(sql`'{}'`),
  noShowCount: integer('no_show_count').notNull().default(0),
  visitCount: integer('visit_count').notNull().default(0),
  vip: boolean('vip').notNull().default(false),
}, (t) => [primaryKey({ columns: [t.restaurantId, t.customerId] })]);

// ---------- Reservas ----------

export const reservation = pgTable('reservation', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').notNull().references(() => customer.id, { onDelete: 'restrict' }),
  serviceId: uuid('service_id').references(() => service.id, { onDelete: 'set null' }),
  seatingUnitId: uuid('seating_unit_id').references(() => seatingUnit.id, { onDelete: 'set null' }),
  zoneId: uuid('zone_id').references(() => zone.id, { onDelete: 'set null' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  partySize: integer('party_size').notNull(),
  status: reservationStatus('status').notNull().default('pending'),
  specialRequests: text('special_requests'),
  source: reservationSource('source').notNull().default('web'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_reservation_day').on(t.restaurantId, t.startsAt),
  index('idx_reservation_status').on(t.restaurantId, t.status),
  index('idx_reservation_customer').on(t.customerId),
  check('reservation_time_chk', sql`${t.endsAt} > ${t.startsAt}`),
  check('reservation_party_chk', sql`${t.partySize} > 0`),
]);

export const reservationMesa = pgTable('reservation_mesa', {
  reservationId: uuid('reservation_id').notNull().references(() => reservation.id, { onDelete: 'cascade' }),
  mesaId: uuid('mesa_id').notNull().references(() => mesa.id, { onDelete: 'cascade' }),
  periodo: tstzrange('periodo').notNull(),
}, (t) => [primaryKey({ columns: [t.reservationId, t.mesaId] })]);
// El constraint sin_solape (EXCLUDE) se agrega en la migración de abajo.

// ---------- Notificaciones ----------

export const notification = pgTable('notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  reservationId: uuid('reservation_id').notNull().references(() => reservation.id, { onDelete: 'cascade' }),
  type: notificationType('type').notNull(),
  channel: notificationChannel('channel').notNull(),
  status: notificationStatus('status').notNull().default('scheduled'),
  scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  providerMessageId: text('provider_message_id'),
  lastError: text('last_error'),
  attempts: integer('attempts').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_notification_due').on(t.scheduledFor).where(sql`${t.status} = 'scheduled'`),
]);

// ---------- SaaS / suscripciones ----------

export const subscriptionPlan = pgTable('subscription_plan', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  currency: text('currency').notNull().default('ARS'),
  interval: text('interval').notNull().default('months'),
  intervalCount: integer('interval_count').notNull().default(1),
  features: jsonb('features').notNull().default(sql`'[]'::jsonb`),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const restaurantSubscription = pgTable('restaurant_subscription', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurant.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').references(() => subscriptionPlan.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('trialing'),
  payerEmail: citext('payer_email'),
  mercadoPagoPreapprovalId: text('mercado_pago_preapproval_id').unique(),
  mercadoPagoInitPoint: text('mercado_pago_init_point'),
  amountCents: integer('amount_cents'),
  currency: text('currency').notNull().default('ARS'),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  nextPaymentDate: timestamp('next_payment_date', { withTimezone: true }),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_restaurant_subscription_restaurant').on(t.restaurantId),
  index('idx_restaurant_subscription_status').on(t.status),
]);

export const billingEvent = pgTable('billing_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').references(() => restaurant.id, { onDelete: 'set null' }),
  provider: text('provider').notNull().default('mercadopago'),
  eventType: text('event_type'),
  externalId: text('external_id'),
  payload: jsonb('payload').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_billing_event_external').on(t.provider, t.externalId),
]);

// ---------- Tipos inferidos (para usar en el código) ----------

export type Reservation = typeof reservation.$inferSelect;
export type NewReservation = typeof reservation.$inferInsert;
export type Mesa = typeof mesa.$inferSelect;
export type SeatingUnitRow = typeof seatingUnit.$inferSelect;
export type Customer = typeof customer.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlan.$inferSelect;
export type RestaurantSubscription = typeof restaurantSubscription.$inferSelect;

// =============================================================
// Migración complementaria (drizzle-kit NO genera esto).
// Crearla a mano y correrla DESPUÉS del push/migrate de Drizzle:
//
//   CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
//   CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- = sobre uuid en el EXCLUDE
//   CREATE EXTENSION IF NOT EXISTS "citext";
//
//   ALTER TABLE reservation_mesa
//     ADD CONSTRAINT sin_solape
//     EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&);
// =============================================================
