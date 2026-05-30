# Sistema de reservas para restaurantes — Documento de arquitectura

> Estado: arquitectura del MVP definida de punta a punta. Este documento es el índice y las decisiones; los artefactos corribles (esquema, motor, API) viven en archivos aparte, listados al final.

## 1. Visión y alcance

Sistema de reservas para restaurantes, vendible tanto a locales chicos (un bistró de ~10 mesas) como a lugares grandes con varias zonas y mesas combinables. El mismo motor abajo, con complejidad opcional arriba: el local chico arranca con defaults sensatos (una sola zona, sin combos, sin pacing), el grande configura todo.

Canales:
- **Reserva web** por link o embed en el sitio del restaurante (canal principal del MVP).
- **Bot de WhatsApp** como servicio adicional (etapa 2).
- **Panel del restaurante** para configuración y gestión (parte central del producto, no un accesorio).

## 2. Decisiones clave

- **Login no obligatorio.** Se capturan los datos mínimos y la cuenta se crea sola en segundo plano (passwordless). Login opcional para clientes que vuelven.
- **Teléfono obligatorio.** Sirve para el recordatorio anti no-show y es el puente al canal de WhatsApp.
- **Recordatorio automático** unas horas antes de la reserva (email y/o WhatsApp).
- **Sin seña.** Pedir seña solo para reservar genera fricción y abandono. Se descarta. Esto además elimina toda la integración de pagos (sin PCI, sin manejo de dinero).
- **Disponibilidad híbrida de dos capas** (pacing de cubiertos + mesa libre). Se elige por sobre la opción más simple de solo-inventario, para servir bien a chicos y grandes desde el inicio.
- **PostgreSQL** como base, por su integridad transaccional y los exclusion constraints que evitan el doble booking a nivel base de datos.

## 3. Flujo de reserva

### Web
1. Book a table (landing)
2. Cantidad de comensales
3. Fecha
4. Horario (según disponibilidad real)
5. Zona / experiencia (si el local la usa)
6. Tus datos — nombre + email + teléfono. Único formulario del flujo. Cuenta passwordless en segundo plano + link opcional de login para recurrentes.
7. Requerimientos especiales (opcional, no bloquea)
8. Reserva confirmada + confirmación por email y/o WhatsApp

### WhatsApp
Igual que la web pero **se saltea el paso 6**: el número ya es identidad verificada, así que no hay captura de datos ni cuenta que crear. Esto de paso resuelve el problema de las reservas spam/falsas.

### Post-reserva
Recordatorio automático unas horas antes por el canal correspondiente.

## 4. Arquitectura del sistema

Tres capas:

**Interfaces**
- Reserva web (link o embed)
- Bot de WhatsApp (conversacional)
- Panel del local (gestión y agenda)

**Núcleo / backend**
- Motor de reservas (turnos, mesas, zonas, disponibilidad)
- Clientes (identidad e historial)
- Notificaciones (confirmar y recordar)

**Servicios externos**
- WhatsApp Business API
- Proveedor de email
- (Pagos / seña: descartado)

Más una **base de datos** que persiste reservas, clientes y configuración.

## 5. Stack técnico

Recomendado, no dogmático:

- **TypeScript** de punta a punta.
- **Next.js** cubriendo las dos caras (booking público + panel) en un mismo repo.
- **PostgreSQL** como base de datos. Decisión central: las reservas son un problema relacional con concurrencia, y Postgres da transacciones + exclusion constraints (`btree_gist`) para impedir solapamientos a nivel base.
- **ORM**: Prisma o Drizzle.
- **Jobs / recordatorios**: cola de jobs. Para el MVP, `pg-boss` (corre sobre el mismo Postgres, evita sumar Redis hasta que haga falta). Más adelante, BullMQ + Redis si escala.
- **Email**: Resend o Postmark.
- **WhatsApp** (etapa 2): Cloud API de Meta directa, o vía un BSP (360dialog, Twilio) para simplificar el alta y las plantillas pre-aprobadas.
- **Auth**: dos contextos separados — comensales con magic link passwordless; staff del restaurante con su propio login.
- **Hosting**: Vercel + Postgres administrado (Neon o Supabase). Supabase aporta Postgres + auth + realtime si se quiere acelerar.

## 6. Multi-tenancy

Base de datos compartida, esquema compartido, `restaurant_id` en todas las tablas, enforced en la capa de queries. Si se usa Supabase, se puede reforzar con Row Level Security (RLS).

## 7. Modelo de datos

Entidades principales:

- **restaurant** (tenant): `id`, `slug`, `timezone`, settings, branding
- **zone**: `id`, `restaurant_id`, `nombre` (Salón principal, Terraza, Barra)
- **mesa**: `id`, `restaurant_id`, `zone_id`, `capacidad_min`, `capacidad_max`
- **service**: `id`, `restaurant_id`, `nombre` (Almuerzo, Cena)
- **shift / turno**: `id`, `service_id`, día de semana, ventana horaria, `slot_interval`, `duracion_turno`
- **customer**: `id`, `telefono`, `email`, `nombre` (identidad global)
- **customer_restaurant**: `restaurant_id`, `customer_id`, notas, tags, `no_show_count`, visitas (la mirada que cada local tiene de cada cliente — lo que le da valor al panel)
- **reservation**: `id`, `restaurant_id`, `customer_id`, `service_id`, `fecha`, `comensales`, `estado`, `requerimientos`, `source` (web/whatsapp/manual)
- **reservation_mesa**: `reservation_id`, `mesa_id`, `periodo` (rango de tiempo) — soporta mesas combinadas
- **notification**: `id`, `reservation_id`, `tipo` (confirmación/recordatorio), `canal`, `estado`, `scheduled_for`, `sent_at`

### Unidades reservables (concepto clave)
No se reserva contra mesas sueltas sino contra **unidades reservables**: cada mesa individual más un conjunto de **combos predefinidos** por el restaurante (mesa 5+6 = hasta 8 personas). Esto mantiene la disponibilidad sobre una lista finita y evita el problema combinatorio de combinar mesas en tiempo real. Reservar una unidad marca ocupadas todas sus mesas físicas.

### Estado de la reserva
Máquina de estados: `pendiente → confirmada → sentada → completada`, con ramas a `cancelada` y `no_show`. Este ciclo alimenta las métricas y los recordatorios.

### Constraint anti doble-booking
```sql
ALTER TABLE reservation_mesa
  ADD CONSTRAINT sin_solape
  EXCLUDE USING gist (mesa_id WITH =, periodo WITH &&);
```
La base rechaza físicamente cualquier solapamiento de reservas en la misma mesa, incluso bajo concurrencia.

> El esquema completo y corrible (todas las tablas, tipos, índices y constraints) está en `schema.sql`.

## 8. Motor de disponibilidad

Modelo **híbrido de dos capas**: un horario está disponible solo si pasa el tope de pacing (cubiertos por ventana, para no fundir la cocina) **y** existe al menos una unidad reservable libre.

### Pipeline de cálculo
1. **Solicitud**: fecha, comensales, zona (opcional).
2. **Resolver configuración**: turnos del día, cierres, horarios especiales. Si está cerrado, no hay horarios.
3. **Generar horarios candidatos**: según `slot_interval`, con tope de última reserva (`shift_end − duracion_turno`).
4. **Filtrar unidades por capacidad**: unidades reservables que entran para ese tamaño de grupo (y zona si se pidió).
5. **Chequeo por horario** (loop por cada candidato):
   - Pacing: cubiertos ya reservados en la ventana + comensales ≤ tope.
   - Solapamiento: existe al menos una unidad cuyas mesas estén todas libres en `[inicio, inicio + duracion_turno)`.
6. **Horarios disponibles**: se devuelven, opcionalmente con la unidad de mejor ajuste para pre-reservar.

### Confirmación (camino crítico de concurrencia)
1. Re-validar el horario (la disponibilidad pudo cambiar entre que el cliente miró y confirmó).
2. Elegir la unidad reservable libre que mejor encaja (best-fit: no sentar a 2 personas en una mesa de 8 si hay algo más chico).
3. Transacción: insertar la reserva + las filas de `reservation_mesa` con su `periodo`. El exclusion constraint garantiza la no superposición.
4. Si el constraint falla (alguien la tomó primero): reintentar con otra unidad; si no queda ninguna, avisar que se acaba de ocupar.

### Implementación
La lógica está en `availability.ts`, separada en dos partes: `computeAvailability` es una función pura sin acceso a la base —recibe la config y las reservas del día ya cargadas y resuelve todo en memoria, así se puede testear sin levantar Postgres— y `bookReservation` es el único punto que pelea con la concurrencia, reintentando sobre el error `23P01` (exclusion_violation) del constraint. Dos notas: el pacing se cuenta como cubiertos que arrancan en la ventana del slot (ajustable según el local), y los turnos que cruzan medianoche todavía no están contemplados (el esquema asume `end_time > start_time` del mismo día).

## 9. API

Contrato REST entre el front y el backend (Next.js route handlers). Base `/api/v1`. Booking público bajo `/r/{slug}` (tenant por slug, sin auth); panel bajo `/admin/*` (sesión de staff). El detalle completo con los shapes de request/response está en `api.md`.

### Booking público
- `GET /r/{slug}` — info pública (zonas, servicios, branding, ventana de reserva).
- `GET /r/{slug}/availability?date=&partySize=&zoneId=` — horarios libres (el read central).
- `POST /r/{slug}/reservations` — crea la reserva; linkea el cliente por teléfono, corre `bookReservation` y devuelve un `dinerToken` para gestionarla sin login. `409` si el horario se ocupó recién.
- `GET/PATCH /r/{slug}/reservations/{id}` — ver, agregar requerimientos, cancelar.

### Auth
- Comensal passwordless: `POST /auth/diner/magic-link`, `POST /auth/diner/verify`, `GET /me/reservations`.
- Staff: `POST /auth/staff/login`, `POST /auth/staff/logout`.

### Panel (staff)
- Configuración: CRUD de `/admin/zones`, `/admin/mesas`, `/admin/seating-units`, `/admin/services`, `/admin/shifts`, `/admin/exceptions`, `/admin/settings`.
- Agenda: `GET /admin/reservations?date=&status=&zoneId=`, `GET /admin/reservations/{id}`, `POST /admin/reservations` (walk-in/manual), `PATCH /admin/reservations/{id}` (estados y reasignación).
- Clientes: `GET /admin/customers`, `GET/PATCH /admin/customers/{id}`.

### Decisiones del contrato
- El `POST /reservations` recalcula disponibilidad y best-fit en el server; nunca confía en el horario o la mesa que manda el cliente.
- La creación abre sesión de comensal (passwordless); el magic link es solo para recurrentes.
- Transiciones de estado validadas contra la máquina de estados; cancelar o marcar `no_show` libera el inventario.
- Las notificaciones las dispara el worker de jobs, no la API.

## 10. Front-end

Una sola app Next.js (App Router) con dos grupos de rutas que comparten design system, cliente de API, i18n y auth: booking público bajo `/r/[slug]` (sin auth) y panel bajo `/admin` (sesión de staff).

- **Flujo de reserva (wizard)**: el estado vive en la URL (paso + selecciones como params), no en memoria. Así el botón atrás funciona, el refresh no rompe y el link es compartible — clave en mobile. La info del restaurante se carga en server component; los pasos son client components.
- **Disponibilidad**: se pide del lado del cliente con React Query a medida que el usuario elige fecha y comensales (cache + revalidación). No es la fuente de verdad: el server revalida al confirmar.
- **Design system**: Tailwind + capa de componentes (shadcn/ui o propia). Branding por restaurante vía CSS variables tomadas de `restaurant.settings.branding`, así el mismo código se ve "de" cada local sin forks. i18n ES/EN.
- **Panel**: más app-like, client-heavy con React Query. La agenda del día se siente casi en tiempo real (polling por ahora, websockets si hace falta). La configuración aplica progressive disclosure: mínima para el chico, completa para el grande.
- **Embed**: script liviano o iframe apuntando a `/r/[slug]` para que el restaurante meta un botón "Reservar" en su propia web.

## 11. No-show sin seña

Se ataca el no-show sin fricción de pago:
- Recordatorio automático antes de la reserva.
- A futuro y opcional: pedir confirmación por WhatsApp el día anterior; contar `no_show_count` por cliente en `customer_restaurant` para que el local tenga visibilidad.

## 12. Casos borde a contemplar desde el día uno

- **Zona horaria** del restaurante: todo se calcula en su huso; atención al horario de verano (DST).
- **Walk-ins y bloqueos manuales** del salón: también ocupan inventario (se modelan como reservas/bloqueos).
- **No-show y cancelación**: liberan la mesa.
- **Ventana de reserva anticipada** con corte: hasta N días antes, hasta M horas antes.
- **Turnos rotativos** (cada 15') vs **horarios fijos** de seating: soportar ambos vía configuración del turno.
- **Mínimos/máximos** de comensales por reserva.
- **Overbooking** opcional (algunos locales sobre-reservan un % a propósito).

## 13. Roadmap por etapas

**Etapa 1 — MVP (producto vendible)**
- Reserva web por link
- Panel con lo mínimo: configurar disponibilidad y ver reservas
- Confirmación por email
- Recordatorio automático
- Motor de disponibilidad híbrido + anti doble-booking

**Etapa 2**
- Bot de WhatsApp (reserva + confirmación + recordatorio por el canal)

**Etapa 3**
- Métricas para el restaurante
- Historial y segmentación de clientes
- Integraciones (Google Reserve, etc.)

## 14. Pendientes / próximos pasos

- Especificación del bot de WhatsApp (plantillas, flujo conversacional, alta en Meta/BSP) — etapa 2.
- Scaffolding del ORM elegido (Prisma o Drizzle) mapeando `schema.sql`.
- Diseño visual fino del panel de configuración (el progressive disclosure ya está definido a nivel arquitectura).
- Valor por defecto de pacing y afinado de las reglas de asignación best-fit.

## 15. Artefactos del repo

- `schema.sql` — esquema PostgreSQL completo, corrible como migración inicial.
- `availability.ts` — motor de disponibilidad (lógica pura) + reserva con concurrencia.
- `api.md` — referencia REST completa con shapes de request/response.
- `frontend-design.md` — dirección visual y plan de implementación del frontend.
- Este documento — índice y decisiones de arquitectura.
