-- =============================================================
-- Sistema de reservas para restaurantes
-- Esquema inicial PostgreSQL (fuente de la verdad)
-- Multi-tenant: restaurant_id en toda tabla de negocio.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- exclusion constraint con = sobre uuid
CREATE EXTENSION IF NOT EXISTS "citext";      -- emails case-insensitive

-- ---------- Tipos enumerados ----------

CREATE TYPE staff_role     AS ENUM ('owner', 'manager', 'host');
CREATE TYPE seating_kind   AS ENUM ('single', 'combo');
CREATE TYPE seating_mode   AS ENUM ('rolling', 'fixed');
CREATE TYPE exception_kind AS ENUM ('closed', 'special_hours');
CREATE TYPE reservation_status AS ENUM
  ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');
CREATE TYPE reservation_source AS ENUM ('web', 'whatsapp', 'manual');
CREATE TYPE notification_type    AS ENUM ('confirmation', 'reminder');
CREATE TYPE notification_channel AS ENUM ('email', 'whatsapp');
CREATE TYPE notification_status  AS ENUM ('scheduled', 'sent', 'failed');

-- ---------- Tenant ----------

CREATE TABLE restaurant (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE,
  name        text NOT NULL,
  timezone    text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires', -- IANA
  settings    jsonb NOT NULL DEFAULT '{}'::jsonb,  -- branding, defaults, ventana de reserva, etc.
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Staff del restaurante ----------

CREATE TABLE staff_user (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  email         citext NOT NULL,
  name          text NOT NULL,
  role          staff_role NOT NULL DEFAULT 'host',
  password_hash text,  -- null si usa magic link
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, email)
);
CREATE INDEX idx_staff_restaurant ON staff_user(restaurant_id);

-- ---------- Salón: zonas y mesas ----------

CREATE TABLE zone (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name          text NOT NULL,
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_zone_restaurant ON zone(restaurant_id);

CREATE TABLE mesa (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  zone_id       uuid NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  name          text NOT NULL,           -- etiqueta o número
  min_capacity  int NOT NULL DEFAULT 1,
  max_capacity  int NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (max_capacity >= min_capacity)
);
CREATE INDEX idx_mesa_restaurant ON mesa(restaurant_id);
CREATE INDEX idx_mesa_zone ON mesa(zone_id);

-- ---------- Unidades reservables (mesa individual o combo) ----------
-- El motor de disponibilidad opera SIEMPRE sobre seating_unit.
-- Cada mesa genera una unidad 'single'; los combos los define el local.

CREATE TABLE seating_unit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name          text NOT NULL,
  kind          seating_kind NOT NULL DEFAULT 'single',
  min_capacity  int NOT NULL,
  max_capacity  int NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (max_capacity >= min_capacity)
);
CREATE INDEX idx_seating_unit_restaurant ON seating_unit(restaurant_id);

CREATE TABLE seating_unit_mesa (
  seating_unit_id uuid NOT NULL REFERENCES seating_unit(id) ON DELETE CASCADE,
  mesa_id         uuid NOT NULL REFERENCES mesa(id) ON DELETE CASCADE,
  PRIMARY KEY (seating_unit_id, mesa_id)
);
CREATE INDEX idx_sum_mesa ON seating_unit_mesa(mesa_id);

-- ---------- Servicios y turnos ----------

CREATE TABLE service (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name          text NOT NULL,           -- Almuerzo, Cena
  position      int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_restaurant ON service(restaurant_id);

CREATE TABLE shift (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  service_id        uuid NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  zone_id           uuid REFERENCES zone(id) ON DELETE CASCADE, -- null = aplica a todas
  day_of_week       smallint NOT NULL,    -- 0=domingo .. 6=sábado
  start_time        time NOT NULL,
  end_time          time NOT NULL,
  slot_interval_min int NOT NULL DEFAULT 15,
  turn_duration_min int NOT NULL DEFAULT 90,  -- cuánto ocupa una sentada
  seating_mode      seating_mode NOT NULL DEFAULT 'rolling',
  fixed_times       time[],               -- usado solo si seating_mode='fixed'
  pacing_cap        int,                  -- cubiertos máx por ventana; null = sin tope
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (day_of_week BETWEEN 0 AND 6),
  CHECK (end_time > start_time)
);
CREATE INDEX idx_shift_lookup ON shift(restaurant_id, service_id, day_of_week);

-- ---------- Excepciones de calendario (cierres / horarios especiales) ----------

CREATE TABLE schedule_exception (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  date          date NOT NULL,
  kind          exception_kind NOT NULL,
  start_time    time,   -- para special_hours
  end_time      time,   -- para special_hours
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exception_lookup ON schedule_exception(restaurant_id, date);

-- ---------- Clientes ----------
-- Identidad global del comensal; la mirada por local va en customer_restaurant.

CREATE TABLE customer (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      text NOT NULL UNIQUE,   -- E.164, identidad principal
  email      citext,
  name       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_restaurant (
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id   uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  notes         text,
  tags          text[] NOT NULL DEFAULT '{}',
  no_show_count int NOT NULL DEFAULT 0,
  visit_count   int NOT NULL DEFAULT 0,
  vip           boolean NOT NULL DEFAULT false,
  PRIMARY KEY (restaurant_id, customer_id)
);

-- ---------- Reservas ----------

CREATE TABLE reservation (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id    uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id      uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  service_id       uuid REFERENCES service(id) ON DELETE SET NULL,
  seating_unit_id  uuid REFERENCES seating_unit(id) ON DELETE SET NULL, -- unidad asignada
  zone_id          uuid REFERENCES zone(id) ON DELETE SET NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  party_size       int NOT NULL,
  status           reservation_status NOT NULL DEFAULT 'pending',
  special_requests text,
  source           reservation_source NOT NULL DEFAULT 'web',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (party_size > 0)
);
CREATE INDEX idx_reservation_day ON reservation(restaurant_id, starts_at);
CREATE INDEX idx_reservation_status ON reservation(restaurant_id, status);
CREATE INDEX idx_reservation_customer ON reservation(customer_id);

-- ---------- Asignación reserva <-> mesa (con anti doble-booking) ----------
-- Una reserva puede ocupar varias mesas (combo). El exclusion constraint
-- impide físicamente que dos reservas se solapen en la misma mesa.
-- IMPORTANTE: al cancelar o marcar no_show, borrar las filas de esta tabla
-- para liberar el inventario (el constraint aplica a TODA fila presente).

CREATE TABLE reservation_mesa (
  reservation_id uuid NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  mesa_id        uuid NOT NULL REFERENCES mesa(id) ON DELETE CASCADE,
  periodo        tstzrange NOT NULL,
  PRIMARY KEY (reservation_id, mesa_id),
  CONSTRAINT sin_solape EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&)
);

-- ---------- Notificaciones (confirmaciones y recordatorios) ----------

CREATE TABLE notification (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  type           notification_type NOT NULL,
  channel        notification_channel NOT NULL,
  status         notification_status NOT NULL DEFAULT 'scheduled',
  scheduled_for  timestamptz NOT NULL,
  sent_at        timestamptz,
  provider_message_id text,
  last_error     text,
  attempts       int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);
-- Soporta el worker de recordatorios: "dame las notifs scheduled vencidas".
CREATE INDEX idx_notification_due
  ON notification(scheduled_for)
  WHERE status = 'scheduled';

-- ---------- SaaS / suscripciones ----------

CREATE TABLE subscription_plan (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL,
  currency text NOT NULL DEFAULT 'ARS',
  interval text NOT NULL DEFAULT 'months',
  interval_count int NOT NULL DEFAULT 1,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_subscription (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES subscription_plan(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'trialing',
  payer_email citext,
  mercado_pago_preapproval_id text UNIQUE,
  mercado_pago_init_point text,
  amount_cents int,
  currency text NOT NULL DEFAULT 'ARS',
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_payment_date timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_restaurant_subscription_restaurant
  ON restaurant_subscription(restaurant_id);
CREATE INDEX idx_restaurant_subscription_status
  ON restaurant_subscription(status);

CREATE TABLE billing_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid REFERENCES restaurant(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'mercadopago',
  event_type text,
  external_id text,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_event_external
  ON billing_event(provider, external_id);
