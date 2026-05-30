# API — Sistema de reservas

Contrato REST entre el front (booking web + panel) y el backend. Pensado para Next.js route handlers, pero agnóstico.

## Convenciones

- Base: `/api/v1`
- **Booking público**: rutas bajo `/r/{slug}` (tenant resuelto por slug del restaurante).
- **Panel**: rutas bajo `/admin/*`, requieren sesión de staff y quedan scopeadas al restaurante de esa sesión.
- Fechas: `YYYY-MM-DD` en hora local del restaurante. Horas en respuestas: ISO 8601 con offset.
- Auth: `Authorization: Bearer <token>`. Dos tipos de sesión: comensal (passwordless) y staff.
- Errores: JSON `{ "error": "codigo", "message": "..." }`. Códigos HTTP estándar; `409` cuando un horario se ocupó entre el browse y el confirm.

---

## 1. Booking público

### `GET /r/{slug}`
Info pública para renderizar el landing y el flujo.
```json
{
  "id": "uuid", "name": "Luuma", "slug": "luuma",
  "timezone": "America/Argentina/Buenos_Aires",
  "zones": [{ "id": "uuid", "name": "Salón principal" }],
  "services": [{ "id": "uuid", "name": "Cena" }],
  "branding": { "logoUrl": "...", "locales": ["es", "en"] },
  "bookingWindow": { "maxDaysAhead": 60, "minHoursBefore": 2 }
}
```

### `GET /r/{slug}/availability`
El read central. Devuelve los horarios libres para una fecha y tamaño de grupo.

Query: `date` (req), `partySize` (req), `zoneId` (opc), `serviceId` (opc).
```json
{
  "date": "2026-05-22", "partySize": 2,
  "slots": [
    { "time": "2026-05-22T20:00:00-03:00", "serviceId": "uuid" },
    { "time": "2026-05-22T20:15:00-03:00", "serviceId": "uuid" },
    { "time": "2026-05-22T22:00:00-03:00", "serviceId": "uuid" }
  ]
}
```
Si el día está cerrado o no hay nada, `slots: []`. La asignación de mesa es interna; el cliente solo ve horarios.

### `POST /r/{slug}/reservations`
Crea la reserva. Captura/linkea el cliente por teléfono, corre `bookReservation` y, si sale, abre una sesión de comensal (passwordless) para que pueda gestionarla. **Revalida disponibilidad del lado del server**: nunca confía en el cliente.

Body:
```json
{
  "date": "2026-05-22", "time": "2026-05-22T22:00:00-03:00",
  "partySize": 2, "zoneId": "uuid", "serviceId": "uuid",
  "customer": { "name": "Facundo Bruna", "email": "fb@mail.com", "phone": "+5491100000000" },
  "specialRequests": null
}
```
`201`:
```json
{
  "reservation": {
    "id": "uuid", "status": "confirmed",
    "startsAt": "2026-05-22T22:00:00-03:00",
    "partySize": 2, "zone": "Salón principal", "service": "Cena"
  },
  "dinerToken": "..."
}
```
`409 { "error": "slot_unavailable" }` si se ocupó recién (el cliente reelige horario).

### `GET /r/{slug}/reservations/{id}`
Ver una reserva (token de la reserva o sesión de comensal). Alimenta la pantalla de confirmación.

### `PATCH /r/{slug}/reservations/{id}`
Modificar requerimientos especiales o cancelar.
```json
{ "specialRequests": "Mesa tranquila, festejo de cumpleaños" }
```
```json
{ "status": "cancelled" }
```
Cancelar libera el inventario (borra las filas de `reservation_mesa`). Transiciones de estado validadas server-side.

---

## 2. Auth

### Comensal (passwordless, opcional para recurrentes)
- `POST /auth/diner/magic-link` — body `{ "email" }` → envía link.
- `POST /auth/diner/verify` — body `{ "token" }` → sesión de comensal.
- `GET /me/reservations` — reservas del comensal logueado (su identidad es global, ve las de todos los locales donde reservó).

### Staff
- `POST /auth/staff/login` — body `{ "email", "password" }` → sesión de staff.
- `POST /auth/staff/logout`.

---

## 3. Panel (staff)

Todas requieren sesión de staff y operan sobre su restaurante.

### Configuración
| Recurso | Endpoints |
|---|---|
| Zonas | `GET/POST /admin/zones` · `PATCH/DELETE /admin/zones/{id}` |
| Mesas | `GET/POST /admin/mesas` · `PATCH/DELETE /admin/mesas/{id}` (crear mesa auto-genera su unidad `single`) |
| Unidades / combos | `GET/POST /admin/seating-units` · `PATCH/DELETE /admin/seating-units/{id}` |
| Servicios | `GET/POST /admin/services` · `PATCH/DELETE /admin/services/{id}` |
| Turnos | `GET/POST /admin/shifts` · `PATCH/DELETE /admin/shifts/{id}` |
| Excepciones | `GET/POST /admin/exceptions` · `PATCH/DELETE /admin/exceptions/{id}` |
| Ajustes | `GET/PATCH /admin/settings` (timezone, branding, ventana de reserva, pacing por defecto) |

El lugar chico usa defaults (una zona, sin combos, `pacingCap` null) y casi no toca esta sección; el grande la configura entera. Mismo backend, complejidad progresiva.

### Gestión de reservas (agenda)
- `GET /admin/reservations?date=&status=&zoneId=` — agenda del día / filtros.
- `GET /admin/reservations/{id}` — detalle.
- `POST /admin/reservations` — alta manual (walk-in o reserva telefónica). Walk-ins y bloqueos del salón se modelan como reservas con `source: "manual"`, así ocupan inventario igual.
- `PATCH /admin/reservations/{id}` — transiciones de estado (`confirmed → seated → completed`, `cancelled`, `no_show`) y reasignación de unidad/mesa.
- `POST /admin/reservations/{id}/resend-confirmation` — reenvía la confirmación.

### Clientes
- `GET /admin/customers?search=` — buscar.
- `GET /admin/customers/{id}` — historial, visitas, `no_show_count`.
- `PATCH /admin/customers/{id}` — notas, tags, VIP (escribe sobre `customer_restaurant`).

---

## 4. Billing SaaS

Endpoints para cobrar la suscripcion mensual del restaurante con Mercado Pago.

### `GET /billing/plans`
Devuelve los planes activos.

### `POST /billing/checkout`
Requiere sesion staff/admin. Crea una suscripcion recurrente en Mercado Pago (`preapproval`) y devuelve `initPoint`.

Body:
```json
{
  "restaurantId": "uuid",
  "planKey": "pro",
  "payerEmail": "dueno@restaurante.com"
}
```

### `POST /billing/webhooks/mercadopago`
Webhook publico de Mercado Pago. Valida `x-signature` si `MERCADOPAGO_WEBHOOK_SECRET` esta configurado, consulta el `preapproval` y actualiza `restaurant_subscription`.

## 5. Jobs

### `POST /jobs/notifications`
Procesa notificaciones vencidas (`scheduled`) y envia emails con Resend. Si `JOBS_SECRET` esta definido, requiere `Authorization: Bearer <secret>`.

---

## Decisiones del contrato

- El `POST /reservations` recalcula disponibilidad y best-fit en el server antes de confirmar; el horario y la mesa nunca se toman del cliente como verdad.
- La creación devuelve `dinerToken` para que el comensal gestione su reserva sin login explícito (el login con magic link es solo para recurrentes).
- Las transiciones de estado se validan contra la máquina de estados; no se permite saltar pasos inválidos.
- Cancelar o marcar `no_show` libera el inventario borrando las filas de `reservation_mesa`.
- Las notificaciones (confirmación, recordatorio) las dispara el worker de jobs, no la API; el recordatorio se agenda al confirmar.
