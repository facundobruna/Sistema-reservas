# Prompt de construcción — Sistema de reservas para restaurantes (SaaS)

Sos un ingeniero de software senior trabajando de forma autónoma. Tu tarea es construir, de punta a punta, el MVP de un SaaS de reservas para restaurantes, siguiendo esta especificación al pie de la letra. La arquitectura ya está decidida; tu trabajo es implementarla, no rediscutirla.

---

## Cómo trabajar (meta-instrucciones)

1. **No te detengas a preguntar.** Cuando algo sea ambiguo, elegí la opción más estándar y sensata, seguí adelante, y registrá la decisión en un archivo `DECISIONS.md` con una línea de justificación.
2. **Trabajá por milestones** (ver "Plan de construcción"). Al terminar cada uno, hacé un commit con un mensaje claro y dejá el milestone funcionando antes de pasar al siguiente.
3. **La corrección del motor de disponibilidad es la prioridad máxima.** Escribí tests unitarios para él (es una función pura, no necesita base). Ningún milestone posterior se da por terminado si el motor tiene bugs.
4. **No agregues features fuera de alcance** (ver "Fuera de alcance"). En particular: NADA de pagos ni señas.
5. **Secrets por variables de entorno.** Entregá un `.env.example`. Nunca hardcodees credenciales.
6. **Entregá un `README.md`** con pasos exactos para levantar el proyecto localmente (instalar, migrar, seed, correr).
7. **Seed de demo:** un script que cree un restaurante de ejemplo con zonas, mesas, servicios y turnos, para poder probar el flujo completo en local.
8. **Mobile-first y accesible** en el flujo de reserva (la mayoría de las reservas se hacen desde el celular).

---

## Producto: qué es y para quién

Sistema de reservas vendible tanto a restaurantes chicos (un bistró de ~10 mesas) como a lugares grandes con varias zonas y mesas combinables. Principio rector: **mismo motor abajo, complejidad opcional arriba.** El local chico arranca con defaults (una zona, sin combos, sin pacing) y casi no configura nada; el grande configura todo. Es multi-tenant.

Tres superficies:
- **Reserva web** por link o embed (canal principal del MVP).
- **Panel del restaurante** para configuración y gestión (parte central del producto).
- **Bot de WhatsApp**: etapa 2, fuera del MVP.

---

## Decisiones cerradas (NO re-litigar)

- **Login no obligatorio para el comensal.** Se capturan datos mínimos y la cuenta se crea sola en segundo plano (passwordless, magic link). El login es opcional, solo para quien vuelve.
- **Teléfono obligatorio** en la reserva web. Es el puente al recordatorio y a WhatsApp.
- **Recordatorio automático** unas horas antes de la reserva (email en el MVP).
- **Sin seña ni pagos.** Punto.
- **Disponibilidad híbrida de dos capas**: un horario está libre solo si pasa el tope de pacing (cubiertos por ventana) Y existe al menos una unidad reservable libre.
- **No-show** se mitiga con el recordatorio y con un contador `no_show_count` por cliente; sin fricción de pago.

---

## Stack (obligatorio)

- **TypeScript** de punta a punta.
- **Next.js** (App Router) cubriendo booking público + panel en un mismo repo.
- **PostgreSQL**. Es la elección central por sus transacciones y exclusion constraints.
- **Drizzle ORM** para el acceso tipado.
- **Jobs/recordatorios**: `pg-boss` (corre sobre el mismo Postgres; no agregar Redis).
- **Email**: usá un proveedor tipo Resend o Postmark detrás de una interfaz `EmailSender` (fácil de swappear). En local, un sender que loguea a consola.
- **Auth**: dos contextos — comensal (magic link passwordless) y staff (login propio).
- **Front data fetching**: React Query (TanStack Query).
- **Estilos**: Tailwind + capa de componentes (shadcn/ui o propia).
- **i18n**: ES/EN.
- **Fechas/timezone**: Luxon (manejo correcto de huso y DST).

---

## Stack — versiones (al día de hoy, mayo 2026)

Instalá la última estable dentro de estas líneas mayores. Los números de patch cambian seguido, así que tomá el último de cada major en vez de fijar un patch exacto a ciegas.

- Node.js 20 LTS o 22 (Next 16 no soporta Node 18).
- TypeScript 5.x
- `next` 16.x (App Router) · `react` y `react-dom` 19.x
- `drizzle-orm` 0.45.x (estable; hay un 1.0 en beta — no lo uses todavía) + `drizzle-kit` la última compatible
- `pg` 8.x + `@types/pg`
- `pg-boss` última estable
- `luxon` 3.x + `@types/luxon`
- `@tanstack/react-query` 5.x
- `tailwindcss` 4.x (+ `@tailwindcss/postcss`)
- `zod` 4.x
- `shadcn/ui` vía su CLI (compatible con Tailwind v4)

Notas de setup que cambiaron y donde los tutoriales viejos te hacen tropezar:
- **Tailwind v4** no usa `tailwind.config.js` por defecto: es config CSS-first (`@import "tailwindcss"` + el plugin `@tailwindcss/postcss`). No sigas guías de v3.
- **Next 16**: las request APIs son async (`await cookies()`, `await headers()`) y usa React 19.
- **Drizzle**: en la definición de tabla, devolvé un ARRAY desde el callback (API actual) para índices y checks; `tstzrange` como customType y el `EXCLUDE` por migración SQL cruda.
- **zod v4**: importá desde `zod`; algunas APIs cambiaron respecto de v3.

## Convenciones de código

- Identificadores de tablas/columnas en el idioma del esquema de abajo (mezcla de inglés con algunos términos en español ya fijados: `mesa`, `periodo`, `sin_solape`). No los traduzcas.
- Copy de la UI en ES/EN vía i18n; nada de texto hardcodeado.
- Multi-tenant: `restaurant_id` en toda query de negocio; jamás devolver datos de otro tenant.
- Todo input validado server-side (usá zod).

---

## Modelo de datos

Implementá exactamente este esquema PostgreSQL. Definí las tablas en Drizzle y aplicá las extensiones y el exclusion constraint mediante una migración SQL (Drizzle no expresa `EXCLUDE`).

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "citext";

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

CREATE TABLE restaurant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff_user (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  email citext NOT NULL,
  name text NOT NULL,
  role staff_role NOT NULL DEFAULT 'host',
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, email)
);

CREATE TABLE zone (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  name text NOT NULL,
  min_capacity int NOT NULL DEFAULT 1,
  max_capacity int NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_capacity >= min_capacity)
);

-- El motor opera SIEMPRE sobre seating_unit. Cada mesa genera una unidad
-- 'single'; los combos ('combo') los define el local y enlazan varias mesas.
CREATE TABLE seating_unit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind seating_kind NOT NULL DEFAULT 'single',
  min_capacity int NOT NULL,
  max_capacity int NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (max_capacity >= min_capacity)
);

CREATE TABLE seating_unit_mesa (
  seating_unit_id uuid NOT NULL REFERENCES seating_unit(id) ON DELETE CASCADE,
  mesa_id uuid NOT NULL REFERENCES mesa(id) ON DELETE CASCADE,
  PRIMARY KEY (seating_unit_id, mesa_id)
);

CREATE TABLE service (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  name text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shift (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES service(id) ON DELETE CASCADE,
  zone_id uuid REFERENCES zone(id) ON DELETE CASCADE,  -- null = todas las zonas
  day_of_week smallint NOT NULL,   -- 0=domingo .. 6=sábado
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_interval_min int NOT NULL DEFAULT 15,
  turn_duration_min int NOT NULL DEFAULT 90,
  seating_mode seating_mode NOT NULL DEFAULT 'rolling',
  fixed_times time[],              -- solo si seating_mode='fixed'
  pacing_cap int,                  -- cubiertos máx por ventana; null = sin tope
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (day_of_week BETWEEN 0 AND 6),
  CHECK (end_time > start_time)
);

CREATE TABLE schedule_exception (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  date date NOT NULL,
  kind exception_kind NOT NULL,
  start_time time,
  end_time time,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,   -- E.164, identidad global
  email citext,
  name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_restaurant (
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  no_show_count int NOT NULL DEFAULT 0,
  visit_count int NOT NULL DEFAULT 0,
  vip boolean NOT NULL DEFAULT false,
  PRIMARY KEY (restaurant_id, customer_id)
);

CREATE TABLE reservation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurant(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customer(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES service(id) ON DELETE SET NULL,
  seating_unit_id uuid REFERENCES seating_unit(id) ON DELETE SET NULL,
  zone_id uuid REFERENCES zone(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  party_size int NOT NULL,
  status reservation_status NOT NULL DEFAULT 'pending',
  special_requests text,
  source reservation_source NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (party_size > 0)
);

-- Anti doble-booking. Al cancelar o marcar no_show, BORRAR las filas de esta
-- tabla para liberar el inventario (el constraint aplica a toda fila presente).
CREATE TABLE reservation_mesa (
  reservation_id uuid NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  mesa_id uuid NOT NULL REFERENCES mesa(id) ON DELETE CASCADE,
  periodo tstzrange NOT NULL,
  PRIMARY KEY (reservation_id, mesa_id),
  CONSTRAINT sin_solape EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&)
);

CREATE TABLE notification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  channel notification_channel NOT NULL,
  status notification_status NOT NULL DEFAULT 'scheduled',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

Creá los índices razonables: `reservation(restaurant_id, starts_at)`, `reservation(restaurant_id, status)`, índices sobre las FKs, y un índice parcial sobre `notification(scheduled_for) WHERE status='scheduled'`.

Al dar de alta una `mesa`, creá automáticamente su `seating_unit` de tipo `single` con la misma capacidad y su fila en `seating_unit_mesa`.

---

## Motor de disponibilidad (el corazón — implementalo con tests)

Implementalo como **lógica pura separada del acceso a base**. Una función `computeAvailability` que recibe la config y las reservas del día ya cargadas (no toca la base) y devuelve los horarios libres. Una función `bookReservation` que es el único punto con concurrencia.

### computeAvailability — algoritmo
Entrada: `{ date, partySize, zoneId? }`, los `shift` del día de la semana, las `seating_unit` activas con sus mesas y capacidades, las reservas activas del día (estado distinto de `cancelled`/`no_show`) con sus mesas y rangos, el `timezone` del restaurante, y la excepción del día si existe.

1. Si la excepción es `closed`, devolver `[]`.
2. Filtrar unidades que entran para `partySize` (entre `min_capacity` y `max_capacity`) y, si se pidió `zoneId`, las de esa zona.
3. Por cada `shift` (si se pidió zona y el shift es de otra zona, saltearlo):
   - Si hay excepción `special_hours`, usar su ventana en lugar de la del shift.
   - Generar horarios candidatos: en modo `rolling`, desde `start_time` hasta `end_time − turn_duration_min` paso `slot_interval_min`; en modo `fixed`, los `fixed_times` dentro de esa ventana. Calcular cada hora local en el `timezone` del restaurante (Luxon).
   - Por cada candidato `start` (con `end = start + turn_duration_min`):
     - **Capa pacing**: si `pacing_cap` no es null, sumar `party_size` de las reservas cuyo `starts_at` cae en `[start, start + slot_interval_min)`; si ese total + `partySize` supera `pacing_cap`, descartar el horario.
     - **Capa mesa**: buscar una unidad libre que entre. Una unidad está libre si TODAS sus mesas están libres en `[start, end)` (sin solapamiento con reservas existentes: `start < r.ends_at && r.starts_at < end`). Best-fit: probar primero las unidades de menor `max_capacity`.
     - Si hay unidad libre, el horario está disponible (guardá la unidad best-fit como sugerencia).
4. Devolver los horarios disponibles ordenados por hora, deduplicados.

### bookReservation — concurrencia
1. Recalcular disponibilidad para el horario pedido (pudo cambiar). Obtener las unidades candidatas ordenadas por best-fit.
2. Por cada unidad candidata, en una transacción: insertar la `reservation` y una fila en `reservation_mesa` por cada mesa de la unidad, con `periodo = tstzrange(starts_at, ends_at, '[)')`.
3. El constraint `sin_solape` garantiza la no superposición. Si la transacción falla con el código Postgres `23P01` (exclusion_violation), hacer rollback y probar la siguiente unidad.
4. Si ninguna unidad entra, devolver error `sin_disponibilidad` (la API responde 409).

Tests obligatorios de `computeAvailability`: día cerrado; sin mesas que entren; solapamiento exacto; pacing que bloquea aunque haya mesas; best-fit elige la unidad más chica; combos; modo fixed.

---

## API (contrato REST, base `/api/v1`)

Booking público bajo `/r/{slug}` (tenant por slug, sin auth). Panel bajo `/admin/*` (sesión de staff, scopeado a su restaurante). Validar todo input con zod. Errores en JSON `{ error, message }`.

**Booking público**
- `GET /r/{slug}` → info pública (zonas, servicios, branding, ventana de reserva).
- `GET /r/{slug}/availability?date=&partySize=&zoneId=` → `{ date, partySize, slots: [{ time, serviceId }] }`.
- `POST /r/{slug}/reservations` → body `{ date, time, partySize, zoneId?, serviceId?, customer: { name, email, phone }, specialRequests? }`. Linkea/crea el `customer` por teléfono, corre `bookReservation`, agenda la notificación de confirmación + el recordatorio, abre sesión de comensal (devuelve `dinerToken`). `201 { reservation, dinerToken }` o `409 { error: 'slot_unavailable' }`. **Revalidar disponibilidad server-side; nunca confiar en el horario/mesa que manda el cliente.**
- `GET /r/{slug}/reservations/{id}` → ver (token de la reserva o sesión).
- `PATCH /r/{slug}/reservations/{id}` → editar `specialRequests` o cancelar (`status: cancelled`, que libera inventario).

**Auth**
- `POST /auth/diner/magic-link`, `POST /auth/diner/verify`, `GET /me/reservations`.
- `POST /auth/staff/login`, `POST /auth/staff/logout`.

**Panel (staff)**
- Configuración: CRUD de `/admin/zones`, `/admin/mesas`, `/admin/seating-units`, `/admin/services`, `/admin/shifts`, `/admin/exceptions`, `/admin/settings`.
- Agenda: `GET /admin/reservations?date=&status=&zoneId=`, `GET /admin/reservations/{id}`, `POST /admin/reservations` (walk-in/manual, `source: manual`, ocupan inventario igual), `PATCH /admin/reservations/{id}` (transiciones de estado y reasignación de unidad/mesa).
- Clientes: `GET /admin/customers?search=`, `GET /admin/customers/{id}`, `PATCH /admin/customers/{id}` (notas, tags, vip → escribe en `customer_restaurant`).

Las transiciones de estado se validan contra la máquina `pending → confirmed → seated → completed` + ramas `cancelled`/`no_show`. Cancelar o `no_show` borra las filas de `reservation_mesa`.

---

## Front-end

Una sola app Next.js (App Router), dos grupos de rutas: booking público en `/r/[slug]/...` (sin auth) y panel en `/admin/...` (sesión de staff). Comparten design system, cliente de API (React Query), i18n y auth.

**Flujo de reserva** (orden de pasos): comensales → fecha → horario → zona (si el local usa más de una) → datos (nombre, email, teléfono; cuenta passwordless en segundo plano; link opcional de "iniciar sesión" para recurrentes) → requerimientos especiales (opcional) → confirmación. **El estado del wizard vive en la URL** (paso + selecciones como params), para que el botón atrás, el refresh y los links funcionen. Info del restaurante en server component; pasos interactivos en client components. La disponibilidad se pide con React Query.

**Branding por restaurante** vía CSS variables tomadas de `restaurant.settings.branding` (logo, color de acento), así el mismo código se ve "de" cada local.

**Panel**: app-like, client-heavy con React Query. Agenda del día con polling. Configuración con progressive disclosure: pantalla mínima para el chico (una zona, sin combos, sin pacing), opciones completas para el grande.

**Embed**: ofrecé un script/iframe liviano apuntando a `/r/[slug]` para que el restaurante meta un botón "Reservar" en su web.

---

## Notificaciones / jobs

Con `pg-boss`: al confirmar una reserva, agendar la confirmación (inmediata) y el recordatorio (configurable, default unas horas antes). Un worker procesa la cola y manda el email vía la interfaz `EmailSender`. Registrar el resultado en la tabla `notification`.

---

## Plan de construcción (milestones, en orden)

1. **Bootstrap**: proyecto Next.js + Drizzle + Postgres, config, `.env.example`, README. Migración inicial (esquema + extensiones + constraint). Seed de demo.
2. **Configuración (panel + API)**: CRUD de zonas, mesas (con auto-creación de seating_unit), combos, servicios, turnos, excepciones, settings. Auth de staff.
3. **Motor de disponibilidad**: `computeAvailability` + tests + `GET /availability`.
4. **Reserva**: `bookReservation` + `POST /reservations` (con creación de cliente passwordless y agendado de notificaciones) + `GET/PATCH` de reserva.
5. **Front de booking**: el wizard completo end-to-end contra la API real, mobile-first, i18n, branding.
6. **Agenda del panel**: ver/gestionar reservas del día, transiciones de estado, alta manual de walk-ins, vista de clientes.
7. **Notificaciones**: worker de pg-boss, confirmación + recordatorio por email.
8. **Embed**: script/iframe del booking.

Al final de cada milestone: que compile, que pase los tests, commit.

---

## Definición de "terminado" (MVP)

- Un comensal completa una reserva en la web de punta a punta contra disponibilidad real, sin posibilidad de doble-booking ni siquiera bajo concurrencia (verificalo con un test que dispare reservas en paralelo sobre la última mesa).
- El staff configura su restaurante y ve/gestiona la agenda del día.
- Se manda email de confirmación y se agenda el recordatorio.
- Tests del motor en verde. README permite levantar todo en local con un comando de setup y el seed.

---

## Fuera de alcance (NO construir en el MVP)

- Pagos y señas (descartado a propósito).
- Bot de WhatsApp (etapa 2).
- Métricas/analytics, integraciones externas (Google Reserve, etc.).
- Turnos que cruzan medianoche (el esquema asume `end_time > start_time` del mismo día).

---

## Errores comunes a evitar (blindaje)

- **Tiempos en hora local sueltos.** Guardá y compará todo en instantes absolutos (`timestamptz` / `tstzrange`); convertí desde y hacia la hora local con la `timezone` del restaurante usando Luxon. Cuidado con DST.
- **`periodo` debe ser semiabierto `'[)'`.** Así dos sentadas que se tocan en el borde (20:00–21:30 y 21:30–23:00) NO cuentan como solapadas. Con `'[]'` se bloquearían entre sí y perderías reservas válidas.
- **Olvidar liberar inventario.** Al pasar a `cancelled` o `no_show`, BORRÁ las filas de `reservation_mesa`. Si no, la mesa queda ocupada para siempre.
- **Saltear la migración del constraint.** Sin `btree_gist` + el `EXCLUDE sin_solape`, perdés la única garantía real anti doble-booking. Es el paso más importante de toda la migración.
- **Confiar en el cliente.** En `POST /reservations`, recalculá disponibilidad y elegí la mesa server-side. El horario y la mesa que manda el front son solo una intención.
- **Fuga entre tenants.** `restaurant_id` en TODA query de negocio. Un bug acá le muestra a un local las reservas de otro.
- **Mezclar las dos capas.** Pacing y mesa son checks independientes: un local con `pacing_cap` en null igual tiene que poder reservar por disponibilidad de mesa.
- **best-fit mal hecho.** Ordená las unidades por `max_capacity` ascendente; no sientes a 2 personas en una mesa de 8 si hay una de 2 libre.
- **Estado del wizard en memoria o localStorage.** Va en la URL, o el refresh y el botón atrás rompen el flujo.
- **Doble submit.** Un doble click no debe crear dos reservas: aprovechá el reintento del constraint y/o un token de idempotencia en el POST.
- **Scope creep.** Nada de pagos, señas ni WhatsApp en el MVP.
