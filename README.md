# Sistema de reservas

MVP SaaS de reservas para restaurantes con Next.js App Router, PostgreSQL, Drizzle, pg-boss, React Query, Tailwind v4, Luxon e i18n ES/EN.

## Requisitos

- Node.js 20+.
- PostgreSQL con una base creada.

## Setup local

1. Copiar `.env.example` a `.env` y ajustar `DATABASE_URL` y `AUTH_SECRET`.
2. Instalar dependencias:

```bash
npm install
```

3. Aplicar la migracion inicial:

```bash
npm run db:migrate
```

4. Cargar datos demo:

```bash
npm run db:seed
```

5. Levantar la app:

```bash
npm run dev
```

Abrir `http://localhost:3000/r/demo-bistro` para reservar y `http://localhost:3000/admin` para el panel.
Para crear un restaurante nuevo de punta a punta, usar `http://localhost:3000/onboarding`.

Credenciales demo del staff:

- Restaurante: `demo-bistro`
- Email: `owner@demo-bistro.test`
- Password: valor de `STAFF_DEMO_PASSWORD` o `admin123`

## Docker

Levantar app + Postgres:

```bash
docker compose up --build
```

Esto expone:

- App: `http://localhost:3000`
- Postgres: `localhost:5433` (dentro de Docker la app usa `postgres:5432`)

El contenedor de la app espera a Postgres, corre `npm run db:migrate` y, con `SEED_DEMO=true`, carga el restaurante demo. El seed no pisa datos si `demo-bistro` ya existe; para recrearlo usar:

```bash
docker compose down
docker compose up --build -d
docker compose exec app sh -lc "RESET_DEMO=true npm run db:seed"
```

Para ver logs:

```bash
docker compose logs -f app
```

Para resetear toda la base local de Docker:

```bash
docker compose down -v
docker compose up --build
```

## Comandos

```bash
npm run test        # tests unitarios del motor de disponibilidad
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # build Next.js
npm run db:migrate  # ejecuta migraciones pendientes en drizzle/
npm run db:seed     # crea restaurante demo completo
npm run worker:notifications
```

## Variables de entorno

Ver `.env.example`. En local `EMAIL_PROVIDER=console` loguea emails en la terminal. Para Resend, usar `EMAIL_PROVIDER=resend` y `RESEND_API_KEY`.
Si corres la app en produccion sobre HTTPS, dejá `AUTH_COOKIE_SECURE=true` o configurá `APP_URL` con `https://`.

Para facturacion B2B con Mercado Pago, configurar:

- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `MP_CURRENCY_ID` (por defecto `ARS`)
- `MP_PLAN_STARTER_AMOUNT`
- `MP_PLAN_GROWTH_AMOUNT`
- `MP_PLAN_SCALE_AMOUNT`

El webhook esperado es `POST /api/v1/mercado-pago/webhook`; en Mercado Pago hay que activar los topicos `subscription_preapproval` y `subscription_authorized_payment`. Sin esas variables, la app sigue funcionando en modo local y la pantalla de facturacion muestra que Mercado Pago esta pendiente.

## Alcance del MVP

Incluye reserva web, panel de configuracion y agenda, onboarding self-serve, facturacion B2B con Mercado Pago, motor anti doble-booking con `EXCLUDE`, notificaciones por email y embed por iframe/script. No incluye pagos o senas al comensal ni WhatsApp.
