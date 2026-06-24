"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowsClockwise,
  CalendarDots,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  Check,
  CheckCircle,
  Clock,
  ClipboardText,
  Code,
  Copy,
  CreditCard,
  ForkKnife,
  GearSix,
  InstagramLogo,
  LinkSimple,
  MagnifyingGlass,
  MapPin,
  Plus,
  QrCode,
  SignOut,
  StackPlus,
  Storefront,
  UsersThree,
  WarningCircle,
  WhatsappLogo,
  XCircle
} from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Panel, Skeleton, inputClassName } from "@/components/ui/field";

type Row = Record<string, unknown>;
type Summary = {
  restaurant?: Row | null;
  zones: Row[];
  mesas: Row[];
  seatingUnits: Row[];
  services: Row[];
  shifts: Row[];
  exceptions: Row[];
};

type Tab = "agenda" | "config" | "customers" | "analytics" | "billing" | "legal";

type AnalyticsSegment = {
  label: string;
  value: number;
  covers?: number;
};

type AnalyticsResponse = {
  range: { from: string; to: string; days: number; timezone: string };
  totals: {
    reservations: number;
    activeReservations: number;
    covers: number;
    uniqueCustomers: number;
    noShows: number;
    cancellations: number;
    noShowRate: number;
    cancellationRate: number;
    occupancyRate: number;
    avgTurnMinutes: number;
  };
  occupancy: {
    seatCapacity: number;
    openHours: number;
    bookedCoverMinutes: number;
    availableCoverMinutes: number;
  };
  daily: Array<{ date: string; reservations: number; covers: number; noShows: number; cancelled: number }>;
  statusMix: AnalyticsSegment[];
  sourceMix: AnalyticsSegment[];
  customerMix: AnalyticsSegment[];
  peakHours: Array<{ hour: number; label: string; reservations: number; covers: number }>;
  topZones: AnalyticsSegment[];
  topServices: AnalyticsSegment[];
  topCustomers: Array<{ name: string; phone: string; reservations: number; covers: number; lastVisit: string | null }>;
};

type BillingPlan = {
  key: "starter" | "growth" | "scale";
  name: string;
  amount: number;
  currencyId: string;
  priceLabel: string;
  reservationLimit: number;
  mesaLimit: number;
  description: string;
};

type BillingResponse = {
  subscription: Row;
  usage: { mesas: number; reservationsThisMonth: number };
  plans: BillingPlan[];
  mercadoPagoConfigured: boolean;
  usable: boolean;
};

const statuses = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const;
type ReservationStatus = (typeof statuses)[number];
const waitlistStatuses = ["open", "notified", "booked", "cancelled"] as const;
type WaitlistStatus = (typeof waitlistStatuses)[number];

const statusCopy: Record<ReservationStatus, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] text-[var(--warning)]" },
  confirmed: { label: "Confirmada", tone: "border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] text-[var(--accent)]" },
  seated: { label: "Sentada", tone: "border-[color-mix(in_srgb,var(--success)_42%,var(--border))] text-[var(--success)]" },
  completed: { label: "Completada", tone: "border-[color-mix(in_srgb,var(--success)_30%,var(--border))] text-[var(--muted-foreground)]" },
  cancelled: { label: "Cancelada", tone: "border-[color-mix(in_srgb,var(--danger)_34%,var(--border))] text-[var(--danger)]" },
  no_show: { label: "No vino", tone: "border-[color-mix(in_srgb,var(--danger)_48%,var(--border))] text-[var(--danger)]" }
};

const waitlistStatusCopy: Record<WaitlistStatus, { label: string; tone: string }> = {
  open: { label: "Abierta", tone: "border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] text-[var(--accent)]" },
  notified: { label: "Avisada", tone: "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] text-[var(--warning)]" },
  booked: { label: "Convertida", tone: "border-[color-mix(in_srgb,var(--success)_42%,var(--border))] text-[var(--success)]" },
  cancelled: { label: "Cancelada", tone: "border-[color-mix(in_srgb,var(--danger)_34%,var(--border))] text-[var(--danger)]" }
};

const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];

function text(row: Row | null | undefined, key: string, fallback = "") {
  const value = row?.[key];
  return value === null || value === undefined ? fallback : String(value);
}

function number(row: Row | null | undefined, key: string, fallback = 0) {
  const value = Number(row?.[key] ?? fallback);
  return Number.isFinite(value) ? value : fallback;
}

function bool(row: Row | null | undefined, key: string) {
  const value = row?.[key];
  return value === true || value === "true";
}

function statusOf(row: Row): ReservationStatus {
  const status = text(row, "status", "confirmed");
  return statuses.includes(status as ReservationStatus) ? (status as ReservationStatus) : "confirmed";
}

function waitlistStatusOf(row: Row): WaitlistStatus {
  const status = text(row, "status", "open");
  return waitlistStatuses.includes(status as WaitlistStatus) ? (status as WaitlistStatus) : "open";
}

function formatTime(value: string, timezone?: string) {
  if (!value) return "-";
  const parsed = DateTime.fromISO(value, timezone ? { zone: timezone } : undefined);
  return parsed.isValid ? parsed.setZone(timezone ?? parsed.zoneName).toFormat("HH:mm") : value;
}

function rowLabel(row: Row, fallback = "Sin nombre") {
  return text(row, "name", fallback);
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? response.statusText);
  }
  return (await response.json()) as T;
}

export function AdminApp() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const requestedTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    requestedTab === "config" ||
      requestedTab === "customers" ||
      requestedTab === "billing" ||
      requestedTab === "analytics" ||
      requestedTab === "legal"
      ? requestedTab
      : "agenda"
  );
  const [date, setDate] = useState(DateTime.now().toISODate() ?? "");

  const summary = useQuery({
    queryKey: ["admin-summary"],
    queryFn: () => api<Summary>("/api/v1/admin/summary"),
    retry: false
  });

  const logout = useMutation({
    mutationFn: () => api("/api/v1/auth/staff/logout", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  if (summary.isError) return <Login onSuccess={() => summary.refetch()} />;

  const restaurantName = text(summary.data?.restaurant, "name", "Panel del restaurante");
  const timezone = text(summary.data?.restaurant, "timezone", "America/Argentina/Buenos_Aires");

  return (
    <main id="content" className="min-h-screen bg-[var(--background)] px-3 py-3 sm:px-5">
      <div className="mx-auto grid max-w-[92rem] gap-4">
        <header className="reveal-in surface-shell">
          <div className="surface-core overflow-hidden">
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1">
                    <Storefront size={14} weight="duotone" />
                    Personal
                  </Badge>
                  <Badge>{timezone}</Badge>
                </div>
                <div>
                  <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Operacion del dia</p>
                  <h1 className="mt-1 text-4xl font-semibold leading-none sm:text-5xl">{restaurantName}</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <DateControl date={date} setDate={setDate} />
                <Button size="sm" variant="ghost" onClick={() => logout.mutate()}>
                  <SignOut size={16} weight="bold" />
                  Salir
                </Button>
              </div>
            </div>

            <nav className="flex gap-1 overflow-x-auto border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_38%,transparent)] p-2">
              <TabButton active={tab === "agenda"} icon={<CalendarDots size={17} weight="duotone" />} onClick={() => setTab("agenda")}>
                Agenda
              </TabButton>
              <TabButton active={tab === "config"} icon={<GearSix size={17} weight="duotone" />} onClick={() => setTab("config")}>
                Configuracion
              </TabButton>
              <TabButton active={tab === "customers"} icon={<UsersThree size={17} weight="duotone" />} onClick={() => setTab("customers")}>
                Clientes
              </TabButton>
              <TabButton active={tab === "analytics"} icon={<ChartBar size={17} weight="duotone" />} onClick={() => setTab("analytics")}>
                Analitica
              </TabButton>
              <TabButton active={tab === "billing"} icon={<CreditCard size={17} weight="duotone" />} onClick={() => setTab("billing")}>
                Facturacion
              </TabButton>
              <TabButton active={tab === "legal"} icon={<ClipboardText size={17} weight="duotone" />} onClick={() => setTab("legal")}>
                Legal
              </TabButton>
            </nav>
          </div>
        </header>

        {summary.isLoading ? <PanelSkeleton /> : null}
        {tab === "agenda" && !summary.isLoading ? <Agenda date={date} setDate={setDate} summary={summary.data} /> : null}
        {tab === "config" && !summary.isLoading ? <Config summary={summary.data} refresh={() => summary.refetch()} /> : null}
        {tab === "customers" && !summary.isLoading ? <Customers /> : null}
        {tab === "analytics" && !summary.isLoading ? <Analytics summary={summary.data} /> : null}
        {tab === "billing" && !summary.isLoading ? <Billing /> : null}
        {tab === "legal" && !summary.isLoading ? <LegalOps /> : null}
      </div>
    </main>
  );
}
function Login({ onSuccess }: { onSuccess: () => void }) {
  const login = useMutation({
    mutationFn: (body: { restaurantSlug: string; email: string; password: string }) =>
      api("/api/v1/auth/staff/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    login.mutate({
      restaurantSlug: String(data.get("restaurantSlug") ?? ""),
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? "")
    });
  }

  return (
    <main id="content" className="grid min-h-screen bg-[var(--background)] px-4 py-6 lg:place-items-center">
      <section className="surface-shell mx-auto grid w-full max-w-5xl">
        <div className="surface-core grid overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="relative hidden min-h-[34rem] content-between overflow-hidden bg-[#261913] p-8 text-[#fff7ec] lg:grid">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(211,135,82,0.28),transparent_22rem),radial-gradient(circle_at_70%_70%,rgba(255,247,236,0.12),transparent_20rem)]" />
            <div className="relative">
              <Badge className="border-white/15 bg-white/10 text-[#f1d6c2]">Panel del restaurante</Badge>
              <h1 className="mt-6 max-w-sm text-5xl font-semibold leading-none">Todo bajo control, sin complicaciones.</h1>
            </div>
            <div className="relative grid gap-3 text-sm text-[#e9d4c3]">
              <p>Agenda, configuracion y clientes en un solo lugar.</p>
              <p>Demo: restaurante demo-bistro, email owner@demo-bistro.test, clave admin123.</p>
            </div>
          </aside>

          <div className="p-5 sm:p-8">
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Acceso del personal</p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight">Entrar al panel</h2>
            <form className="mt-7 grid gap-4" onSubmit={submit}>
              <Field label="Restaurante">
                <input className={inputClassName} defaultValue="demo-bistro" name="restaurantSlug" />
              </Field>
              <Field label="Email">
                <input className={inputClassName} defaultValue="owner@demo-bistro.test" name="email" type="email" />
              </Field>
              <Field label="Password">
                <input className={inputClassName} defaultValue="admin123" name="password" type="password" />
              </Field>
              {login.error ? (
                <div className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card-raised))] p-3 text-sm text-[var(--danger)]">
                  {login.error.message}
                </div>
              ) : null}
              <Button disabled={login.isPending} type="submit">
                <Check size={18} weight="bold" />
                {login.isPending ? "Validando" : "Ingresar"}
              </Button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
function PanelSkeleton() {
  return (
    <Panel className="reveal-in">
      <div className="grid gap-4 p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton className="h-24" key={index} />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    </Panel>
  );
}

function DateControl({ date, setDate }: { date: string; setDate: (date: string) => void }) {
  return (
    <label className="flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 text-sm font-semibold shadow-[var(--shadow-soft)]">
      <CalendarDots size={16} weight="duotone" className="text-[var(--accent)]" />
      <input className="bg-transparent outline-none" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
    </label>
  );
}

function TabButton({
  active,
  icon,
  children,
  onClick
}: {
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-sm)] px-4 text-sm font-semibold transition-all duration-500 ease-[var(--ease-press)] ${
        active
          ? "bg-[var(--card-raised)] text-[var(--foreground)] shadow-[var(--shadow-soft)]"
          : "text-[var(--muted-foreground)] hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)] hover:text-[var(--foreground)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {children}
    </button>
  );
}

function Agenda({
  date,
  setDate,
  summary
}: {
  date: string;
  setDate: (date: string) => void;
  summary?: Summary;
}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReservationStatus | "">("");
  const [zoneFilter, setZoneFilter] = useState("");
  const timezone = text(summary?.restaurant, "timezone", "America/Argentina/Buenos_Aires");

  const reservations = useQuery({
    queryKey: ["admin-reservations", date, statusFilter, zoneFilter],
    queryFn: () => {
      const query = new URLSearchParams({ date });
      if (statusFilter) query.set("status", statusFilter);
      if (zoneFilter) query.set("zoneId", zoneFilter);
      return api<{ reservations: Row[] }>(`/api/v1/admin/reservations?${query.toString()}`);
    },
    refetchInterval: 20_000
  });

  const waitlist = useQuery({
    queryKey: ["admin-waitlist", date],
    queryFn: () => api<{ entries: Row[] }>(`/api/v1/admin/waitlist?date=${encodeURIComponent(date)}`),
    refetchInterval: 30_000
  });

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      api(`/api/v1/admin/reservations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });

  const updateWaitlist = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WaitlistStatus }) =>
      api(`/api/v1/admin/waitlist/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-waitlist"] })
  });

  const manual = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/admin/reservations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });

  const rows = useMemo(() => reservations.data?.reservations ?? [], [reservations.data?.reservations]);
  const waitlistRows = useMemo(() => waitlist.data?.entries ?? [], [waitlist.data?.entries]);
  const metrics = useMemo(() => {
    const activeRows = rows.filter((row) => !["cancelled", "no_show"].includes(statusOf(row)));
    const seated = rows.filter((row) => statusOf(row) === "seated").length;
    const covers = activeRows.reduce((sum, row) => sum + number(row, "party_size"), 0);
    const next = activeRows[0];
    return { active: activeRows.length, seated, covers, next };
  }, [rows]);

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const localTime = String(data.get("time") ?? "");
    const time = DateTime.fromISO(`${date}T${localTime}`, { zone: timezone }).toISO() ?? "";
    manual.mutate({
      date,
      time,
      partySize: Number(data.get("partySize") ?? 2),
      zoneId: String(data.get("zoneId") || "") || null,
      serviceId: String(data.get("serviceId") || "") || null,
      customer: {
        name: String(data.get("name") ?? "").trim(),
        email: String(data.get("email") || "").trim() || null,
        phone: String(data.get("phone") ?? "").trim()
      },
      specialRequests: String(data.get("specialRequests") || "").trim() || null,
      source: "manual"
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard icon={<ClipboardText size={20} weight="duotone" />} label="Reservas activas" value={String(metrics.active)} />
          <MetricCard icon={<UsersThree size={20} weight="duotone" />} label="Cubiertos" value={String(metrics.covers)} />
          <MetricCard icon={<ForkKnife size={20} weight="duotone" />} label="En salon" value={String(metrics.seated)} />
          <MetricCard
            icon={<Clock size={20} weight="duotone" />}
            label="Proxima mesa"
            value={metrics.next ? formatTime(text(metrics.next, "starts_at"), timezone) : "-"}
          />
        </div>

        <Panel className="reveal-in reveal-delay-1 overflow-hidden">
          <div className="border-b border-[var(--border)] p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Agenda</p>
                <h2 className="mt-1 text-3xl font-semibold">
                  {DateTime.fromISO(date).setLocale("es").toFormat("cccc dd LLL")}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => reservations.refetch()}>
                  <ArrowsClockwise size={16} weight="bold" />
                  Actualizar
                </Button>
                <DateControl date={date} setDate={setDate} />
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-[1fr_14rem]">
              <div className="flex gap-1 overflow-x-auto rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--muted)_58%,transparent)] p-1">
                <FilterChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>Todos</FilterChip>
                {statuses.map((status) => (
                  <FilterChip active={statusFilter === status} key={status} onClick={() => setStatusFilter(status)}>
                    {statusCopy[status].label}
                  </FilterChip>
                ))}
              </div>
              <select className={inputClassName} value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                <option value="">Todas las zonas</option>
                {summary?.zones.map((zone) => (
                  <option key={text(zone, "id")} value={text(zone, "id")}>
                    {rowLabel(zone)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2 p-3 sm:p-4">
            {reservations.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-24" key={index} />)
            ) : reservations.isError ? (
              <EmptyState
                title="No pudimos cargar la agenda"
                description="La sesion o la conexion fallaron. Reintentá la consulta antes de operar el salon."
                action={
                  <Button variant="secondary" onClick={() => reservations.refetch()}>
                    <ArrowsClockwise size={18} weight="bold" />
                    Reintentar
                  </Button>
                }
              />
            ) : rows.length ? (
              rows.map((row) => (
                <ReservationRow
                  key={text(row, "id")}
                  row={row}
                  timezone={timezone}
                  busy={transition.isPending}
                  onTransition={(status) => transition.mutate({ id: text(row, "id"), status })}
                />
              ))
            ) : (
              <EmptyState
                title="Agenda despejada"
                description="No hay reservas con estos filtros. Podés cargar una reserva manual desde el panel lateral."
              />
            )}
          </div>
        </Panel>

        <Panel className="reveal-in reveal-delay-2 overflow-hidden">
          <div className="border-b border-[var(--border)] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Lista de espera</p>
                <h2 className="mt-1 text-2xl font-semibold">Solicitudes del dia</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => waitlist.refetch()}>
                <ArrowsClockwise size={16} weight="bold" />
                Actualizar
              </Button>
            </div>
          </div>
          <div className="grid gap-2 p-3 sm:p-4">
            {waitlist.isLoading ? (
              Array.from({ length: 3 }).map((_, index) => <Skeleton className="h-20" key={index} />)
            ) : waitlist.isError ? (
              <EmptyState title="No pudimos cargar la lista" description="Reintenta la consulta antes de contactar a los comensales." />
            ) : waitlistRows.length ? (
              waitlistRows.map((row) => (
                <WaitlistRow
                  busy={updateWaitlist.isPending}
                  key={text(row, "id")}
                  row={row}
                  onStatus={(status) => updateWaitlist.mutate({ id: text(row, "id"), status })}
                />
              ))
            ) : (
              <EmptyState title="Sin espera" description="Cuando no haya horarios disponibles, las solicitudes van a aparecer aca." />
            )}
          </div>
        </Panel>
      </section>

      <Panel className="reveal-in reveal-delay-2 xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-5 p-4 sm:p-5">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Alta manual</p>
            <h3 className="mt-1 text-2xl font-semibold">Reserva por telefono o walk-in</h3>
          </div>
          <form className="grid gap-3" onSubmit={submitManual}>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Hora"><input className={inputClassName} name="time" required type="time" /></Field>
              <Field label="Comensales"><input className={inputClassName} defaultValue={2} min={1} name="partySize" type="number" /></Field>
            </div>
            <Field label="Servicio">
              <select className={inputClassName} name="serviceId">
                {summary?.services.map((service) => (
                  <option key={text(service, "id")} value={text(service, "id")}>
                    {rowLabel(service)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Zona">
              <select className={inputClassName} name="zoneId">
                <option value="">Cualquiera</option>
                {summary?.zones.map((zone) => (
                  <option key={text(zone, "id")} value={text(zone, "id")}>
                    {rowLabel(zone)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
            <Field label="Telefono"><input className={inputClassName} name="phone" required /></Field>
            <Field label="Email"><input className={inputClassName} name="email" type="email" /></Field>
            <Field label="Notas"><textarea className={`${inputClassName} min-h-24 py-3`} name="specialRequests" /></Field>
            {manual.error ? (
              <div className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card-raised))] p-3 text-sm text-[var(--danger)]">
                {manual.error.message}
              </div>
            ) : null}
            {manual.isSuccess ? (
              <div className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--success)_12%,var(--card-raised))] p-3 text-sm text-[var(--success)]">
                Reserva creada y bloqueada en inventario.
              </div>
            ) : null}
            <Button disabled={manual.isPending} type="submit">
              <Plus size={18} weight="bold" />
              {manual.isPending ? "Creando" : "Crear reserva"}
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Panel className="reveal-in">
      <div className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--accent)]">{icon}</span>
          <span className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{label}</span>
        </div>
        <p className="font-mono text-3xl font-semibold tabular-nums">{value}</p>
      </div>
    </Panel>
  );
}

function FilterChip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      className={`min-h-9 shrink-0 rounded-[var(--radius-xs)] px-3 text-xs font-semibold transition-all duration-500 ${
        active ? "bg-[var(--card-raised)] text-[var(--foreground)] shadow-[var(--shadow-soft)]" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function ReservationRow({
  row,
  timezone,
  busy,
  onTransition
}: {
  row: Row;
  timezone: string;
  busy: boolean;
  onTransition: (status: ReservationStatus) => void;
}) {
  const status = statusOf(row);
  const actions = nextActions(status);
  const guests = number(row, "party_size");
  const request = text(row, "special_requests");

  return (
    <article className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--card-raised)_86%,transparent)] p-3 transition-all duration-500 hover:border-[var(--border-strong)] sm:grid-cols-[6rem_1fr_auto] sm:items-center sm:p-4">
      <div className="grid content-center rounded-[var(--radius-md)] bg-[var(--muted)] p-3 text-center">
        <span className="font-mono text-2xl font-semibold tabular-nums">{formatTime(text(row, "starts_at"), timezone)}</span>
        <span className="text-xs text-[var(--muted-foreground)]">{guests} cub.</span>
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold">{text(row, "customer_name", "Sin nombre")}</h3>
          <StatusBadge status={status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1"><UsersThree size={14} weight="duotone" />{text(row, "customer_phone", "-")}</span>
          <span className="inline-flex items-center gap-1"><ForkKnife size={14} weight="duotone" />{text(row, "service_name", "Servicio")}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={14} weight="duotone" />{text(row, "zone_name", "Sin zona")}</span>
          <span className="inline-flex items-center gap-1"><StackPlus size={14} weight="duotone" />{text(row, "seating_unit_name", "Unidad auto")}</span>
        </div>
        {request ? <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]">{request}</p> : null}
      </div>

      <div className="flex flex-wrap justify-start gap-2 sm:max-w-52 sm:justify-end">
        {actions.map((action) => (
          <Button
            disabled={busy}
            key={action.status}
            size="sm"
            variant={action.variant}
            onClick={() => onTransition(action.status)}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </article>
  );
}

function WaitlistRow({
  row,
  busy,
  onStatus
}: {
  row: Row;
  busy: boolean;
  onStatus: (status: WaitlistStatus) => void;
}) {
  const status = waitlistStatusOf(row);
  const item = waitlistStatusCopy[status];
  const partySize = number(row, "party_size");
  const request = text(row, "special_requests");

  return (
    <article className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--card-raised)_86%,transparent)] p-3 sm:grid-cols-[1fr_auto] sm:items-center sm:p-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-semibold">{text(row, "customer_name", "Sin nombre")}</h3>
          <Badge className={item.tone}>{item.label}</Badge>
          <Badge>{partySize} cub.</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1"><UsersThree size={14} weight="duotone" />{text(row, "customer_phone", "-")}</span>
          <span className="inline-flex items-center gap-1"><Clock size={14} weight="duotone" />{text(row, "preferred_time", "Sin horario")}</span>
          <span className="inline-flex items-center gap-1"><ForkKnife size={14} weight="duotone" />{text(row, "service_name", "Servicio")}</span>
          <span className="inline-flex items-center gap-1"><MapPin size={14} weight="duotone" />{text(row, "zone_name", "Sin zona")}</span>
        </div>
        {request ? <p className="mt-2 line-clamp-2 text-sm text-[var(--foreground)]">{request}</p> : null}
      </div>

      <div className="flex flex-wrap justify-start gap-2 sm:max-w-56 sm:justify-end">
        {status === "open" ? (
          <Button disabled={busy} size="sm" variant="secondary" onClick={() => onStatus("notified")}>
            <Check size={15} weight="bold" />
            Avisada
          </Button>
        ) : null}
        {status !== "booked" ? (
          <Button disabled={busy} size="sm" onClick={() => onStatus("booked")}>
            <CheckCircle size={15} weight="bold" />
            Convertida
          </Button>
        ) : null}
        {status !== "cancelled" ? (
          <Button disabled={busy} size="sm" variant="danger" onClick={() => onStatus("cancelled")}>
            <XCircle size={15} weight="bold" />
            Cancelar
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const item = statusCopy[status];
  return <Badge className={item.tone}>{item.label}</Badge>;
}

function nextActions(status: ReservationStatus) {
  if (status === "pending") {
    return [
      { status: "confirmed" as const, label: "Confirmar", variant: "secondary" as const, icon: <CheckCircle size={15} weight="bold" /> },
      { status: "cancelled" as const, label: "Cancelar", variant: "danger" as const, icon: <XCircle size={15} weight="bold" /> }
    ];
  }
  if (status === "confirmed") {
    return [
      { status: "seated" as const, label: "Sentar", variant: "primary" as const, icon: <ForkKnife size={15} weight="bold" /> },
      { status: "cancelled" as const, label: "Cancelar", variant: "danger" as const, icon: <XCircle size={15} weight="bold" /> },
      { status: "no_show" as const, label: "No vino", variant: "secondary" as const, icon: <WarningCircle size={15} weight="bold" /> }
    ];
  }
  if (status === "seated") {
    return [
      { status: "completed" as const, label: "Completar", variant: "primary" as const, icon: <CheckCircle size={15} weight="bold" /> },
      { status: "cancelled" as const, label: "Cancelar", variant: "danger" as const, icon: <XCircle size={15} weight="bold" /> }
    ];
  }
  return [];
}

function Config({ summary, refresh }: { summary?: Summary; refresh: () => void }) {
  const create = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      api(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: refresh
  });
  const settings = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/admin/settings", { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: refresh
  });

  function submit(path: string, body: Record<string, unknown>) {
    create.mutate({ path, body });
  }

  const restaurantSettings = (summary?.restaurant?.settings as Record<string, unknown> | undefined) ?? {};
  const branding = (restaurantSettings.branding as Record<string, unknown> | undefined) ?? {};
  const restaurantName = text(summary?.restaurant, "name", "Restaurante");
  const restaurantSlug = text(summary?.restaurant, "slug", "demo-bistro");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="grid gap-4">
        <ConfigOverview summary={summary} />

        <div className="grid gap-4 lg:grid-cols-2">
          <ConfigForm
            description="Crea sectores del salon. Si el local es chico, una sola zona alcanza."
            error={create.error}
            pending={create.isPending}
            title="Zonas"
            onSubmit={(data) => submit("/api/v1/admin/zones", { name: data.get("name"), position: Number(data.get("position") ?? 0) })}
          >
            <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
            <Field label="Orden"><input className={inputClassName} defaultValue={0} name="position" type="number" /></Field>
            <ExistingList items={summary?.zones ?? []} render={(zone) => `${rowLabel(zone)} - orden ${text(zone, "position", "0")}`} />
          </ConfigForm>

          <ConfigForm
            description="Cada mesa que agregues va a aparecer disponible en la agenda."
            error={create.error}
            pending={create.isPending}
            title="Mesas"
            onSubmit={(data) =>
              submit("/api/v1/admin/mesas", {
                name: data.get("name"),
                zoneId: data.get("zoneId"),
                minCapacity: Number(data.get("minCapacity") ?? 1),
                maxCapacity: Number(data.get("maxCapacity") ?? 2),
                active: true
              })
            }
          >
            <Field label="Zona">
              <select className={inputClassName} name="zoneId">
                {summary?.zones.map((zone) => <option key={text(zone, "id")} value={text(zone, "id")}>{rowLabel(zone)}</option>)}
              </select>
            </Field>
            <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min"><input className={inputClassName} defaultValue={1} name="minCapacity" type="number" /></Field>
              <Field label="Max"><input className={inputClassName} defaultValue={2} name="maxCapacity" type="number" /></Field>
            </div>
            <ExistingList items={summary?.mesas ?? []} render={(mesa) => `${rowLabel(mesa)} - ${text(mesa, "minCapacity", "1")}/${text(mesa, "maxCapacity", "2")} cub.`} />
          </ConfigForm>

          <ConfigForm
            description="Para grupos que necesitan mas de una mesa juntas."
            error={create.error}
            pending={create.isPending}
            title="Combos"
            onSubmit={(data) =>
              submit("/api/v1/admin/seating-units", {
                name: data.get("name"),
                kind: "combo",
                minCapacity: Number(data.get("minCapacity") ?? 1),
                maxCapacity: Number(data.get("maxCapacity") ?? 4),
                mesaIds: data.getAll("mesaIds").map(String).filter(Boolean),
                active: true
              })
            }
          >
            <Field label="Nombre"><input className={inputClassName} name="name" placeholder="Mesa 4 + 5" required /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Min"><input className={inputClassName} defaultValue={3} name="minCapacity" type="number" /></Field>
              <Field label="Max"><input className={inputClassName} defaultValue={6} name="maxCapacity" type="number" /></Field>
            </div>
            <Field label="Mesas">
              <select className={`${inputClassName} min-h-28 py-2`} multiple name="mesaIds">
                {summary?.mesas.map((mesa) => <option key={text(mesa, "id")} value={text(mesa, "id")}>{rowLabel(mesa)}</option>)}
              </select>
            </Field>
            <ExistingList items={(summary?.seatingUnits ?? []).filter((unit) => text(unit, "kind") === "combo")} render={(unit) => `${rowLabel(unit)} - hasta ${text(unit, "maxCapacity", "0")}`} />
          </ConfigForm>

          <ConfigForm
            description="Servicios visibles en agenda y disponibilidad."
            error={create.error}
            pending={create.isPending}
            title="Servicios"
            onSubmit={(data) => submit("/api/v1/admin/services", { name: data.get("name"), position: Number(data.get("position") ?? 0) })}
          >
            <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
            <Field label="Orden"><input className={inputClassName} defaultValue={0} name="position" type="number" /></Field>
            <ExistingList items={summary?.services ?? []} render={(service) => rowLabel(service)} />
          </ConfigForm>

          <ConfigForm
            className="lg:col-span-2"
            description="Define los dias y horarios en que los clientes pueden reservar."
            error={create.error}
            pending={create.isPending}
            title="Turnos"
            onSubmit={(data) =>
              submit("/api/v1/admin/shifts", {
                serviceId: data.get("serviceId"),
                zoneId: String(data.get("zoneId") || "") || null,
                dayOfWeek: Number(data.get("dayOfWeek") ?? 0),
                startTime: data.get("startTime"),
                endTime: data.get("endTime"),
                slotIntervalMin: Number(data.get("slotIntervalMin") ?? 30),
                turnDurationMin: Number(data.get("turnDurationMin") ?? 90),
                bufferMin: Number(data.get("bufferMin") ?? 0),
                seatingMode: data.get("seatingMode"),
                fixedTimes: String(data.get("fixedTimes") || "").split(",").map((item) => item.trim()).filter(Boolean),
                pacingCap: String(data.get("pacingCap") || "") ? Number(data.get("pacingCap")) : null,
                overbookingPct: Number(data.get("overbookingPct") ?? 0)
              })
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Servicio"><select className={inputClassName} name="serviceId">{summary?.services.map((service) => <option key={text(service, "id")} value={text(service, "id")}>{rowLabel(service)}</option>)}</select></Field>
              <Field label="Zona"><select className={inputClassName} name="zoneId"><option value="">Todas</option>{summary?.zones.map((zone) => <option key={text(zone, "id")} value={text(zone, "id")}>{rowLabel(zone)}</option>)}</select></Field>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <Field label="Dia"><select className={inputClassName} name="dayOfWeek">{dayNames.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></Field>
              <Field label="Inicio"><input className={inputClassName} name="startTime" required type="time" /></Field>
              <Field label="Fin"><input className={inputClassName} name="endTime" required type="time" /></Field>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <Field label="Intervalo"><input className={inputClassName} defaultValue={30} name="slotIntervalMin" type="number" /></Field>
              <Field label="Duracion"><input className={inputClassName} defaultValue={90} name="turnDurationMin" type="number" /></Field>
              <Field label="Limpieza"><input className={inputClassName} defaultValue={0} min={0} name="bufferMin" type="number" /></Field>
              <Field label="Modo"><select className={inputClassName} name="seatingMode"><option value="rolling">Continuo</option><option value="fixed">Horarios fijos</option></select></Field>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <Field hint="Maximo de personas por franja horaria. Dejar vacio si no hay limite." label="Limite de cubiertos"><input className={inputClassName} min={1} name="pacingCap" type="number" /></Field>
              <Field hint="Porcentaje adicional de reservas permitidas sobre el limite normal." label="Sobre-cupo %"><input className={inputClassName} defaultValue={0} max={100} min={0} name="overbookingPct" type="number" /></Field>
            </div>
            <Field label="Horarios fijos"><input className={inputClassName} name="fixedTimes" placeholder="12:00, 13:30" /></Field>
            <ExistingList
              items={summary?.shifts ?? []}
              render={(shift) => {
                const start = text(shift, "start_time");
                const end = text(shift, "end_time");
                const crossesMidnight = end && start && end <= start;
                const buffer = number(shift, "buffer_min");
                const overbooking = number(shift, "overbooking_pct");
                return `${dayNames[number(shift, "day_of_week")]} ${start} - ${end}${crossesMidnight ? " (+1)" : ""} - limpieza ${buffer}m - sobre-cupo ${overbooking}%`;
              }}
            />
          </ConfigForm>

          <ConfigForm
            className="lg:col-span-2"
            description="Dias que el local esta cerrado o con horario distinto al habitual."
            error={create.error}
            pending={create.isPending}
            title="Excepciones"
            onSubmit={(data) =>
              submit("/api/v1/admin/exceptions", {
                date: data.get("date"),
                kind: data.get("kind"),
                startTime: String(data.get("startTime") || "") || null,
                endTime: String(data.get("endTime") || "") || null,
                note: String(data.get("note") || "") || null
              })
            }
          >
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fecha"><input className={inputClassName} name="date" required type="date" /></Field>
              <Field label="Tipo"><select className={inputClassName} name="kind"><option value="closed">Cerrado</option><option value="special_hours">Horario especial</option></select></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Inicio"><input className={inputClassName} name="startTime" type="time" /></Field>
              <Field label="Fin"><input className={inputClassName} name="endTime" type="time" /></Field>
            </div>
            <Field label="Nota"><input className={inputClassName} name="note" /></Field>
            <ExistingList
              items={summary?.exceptions ?? []}
              render={(item) => {
                const kind = text(item, "kind") === "closed" ? "Cerrado" : "Horario especial";
                const start = text(item, "start_time");
                const end = text(item, "end_time");
                const crossesMidnight = end && start && end <= start;
                return `${text(item, "date")} - ${kind}${start && end ? ` ${start}-${end}${crossesMidnight ? " (+1)" : ""}` : ""}`;
              }}
            />
          </ConfigForm>
        </div>
      </section>

      <aside className="grid gap-4 xl:sticky xl:top-4 xl:self-start">
        <DistributionPanel restaurantName={restaurantName} restaurantSlug={restaurantSlug} />

        <Panel className="reveal-in reveal-delay-2">
          <div className="grid gap-5 p-4 sm:p-5">
            <div>
              <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Identidad publica</p>
              <h3 className="mt-1 text-2xl font-semibold">Apariencia del restaurante</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
                Esta informacion aparece en la pagina de reservas que ven tus clientes.
              </p>
            </div>
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                settings.mutate({
                  name: String(data.get("name") || ""),
                  timezone: String(data.get("timezone") || ""),
                  settings: {
                    branding: {
                      ...branding,
                      accent: String(data.get("accent") || "#8e3f24"),
                      heroImageUrl: String(data.get("heroImageUrl") || "") || null,
                      logoUrl: String(data.get("logoUrl") || "") || null
                    }
                  }
                });
              }}
            >
              <Field label="Nombre publico"><input className={inputClassName} defaultValue={text(summary?.restaurant, "name")} name="name" /></Field>
              <Field label="Timezone"><input className={inputClassName} defaultValue={text(summary?.restaurant, "timezone")} name="timezone" /></Field>
              <Field label="Color acento"><input className={`${inputClassName} h-12 p-1`} defaultValue={String(branding.accent ?? "#8e3f24")} name="accent" type="color" /></Field>
              <Field label="Hero image URL"><input className={inputClassName} defaultValue={String(branding.heroImageUrl ?? "")} name="heroImageUrl" /></Field>
              <Field label="Logo URL"><input className={inputClassName} defaultValue={String(branding.logoUrl ?? "")} name="logoUrl" /></Field>
              {settings.error ? <p className="text-sm text-[var(--danger)]">{settings.error.message}</p> : null}
              {settings.isSuccess ? <p className="text-sm text-[var(--success)]">Identidad actualizada.</p> : null}
              <Button disabled={settings.isPending} type="submit">
                <Check size={18} weight="bold" />
                Guardar identidad
              </Button>
            </form>
          </div>
        </Panel>
      </aside>
    </div>
  );
}

function DistributionPanel({ restaurantName, restaurantSlug }: { restaurantName: string; restaurantSlug: string }) {
  const [origin] = useState(() =>
    typeof window === "undefined" ? (process.env.NEXT_PUBLIC_APP_URL ?? "https://tu-dominio.com") : window.location.origin
  );
  const [copied, setCopied] = useState("");

  const baseUrl = origin;
  const bookingUrl = `${baseUrl}/r/${restaurantSlug}`;
  const embedScript = `<script async src="${baseUrl}/embed/${restaurantSlug}/script"></script>`;
  const reserveButton = `<a href="${bookingUrl}" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:8px;background:#111;color:#fff;text-decoration:none;font-weight:600">Reservar</a>`;
  const whatsappReply = `Hola! Para reservar en ${restaurantName}, toca este link: ${bookingUrl}\n\nEs rapido: sin cuenta, DNI, sena ni app.`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=184x184&margin=12&data=${encodeURIComponent(bookingUrl)}`;

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      setCopied("error");
      window.setTimeout(() => setCopied(""), 1400);
    }
  }

  return (
    <Panel className="reveal-in reveal-delay-1">
      <div className="grid gap-5 p-4 sm:p-5">
        <div>
          <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Distribucion</p>
          <h3 className="mt-1 text-2xl font-semibold">Un link, todos los canales</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
            Compartí el link de reservas por Instagram, tu web, un QR o WhatsApp.
          </p>
        </div>

        <DistributionCopy
          copied={copied}
          description="Pegalo en tu perfil de Instagram para que tus seguidores reserven directo."
          icon={<InstagramLogo size={20} weight="duotone" />}
          label="Instagram"
          value={bookingUrl}
          onCopy={copyValue}
        />
        <DistributionCopy
          copied={copied}
          description="Un boton de reserva para pegar en tu pagina web."
          icon={<LinkSimple size={20} weight="duotone" />}
          label="Pagina web"
          value={reserveButton}
          onCopy={copyValue}
        />
        <DistributionCopy
          copied={copied}
          description="Instala el formulario de reserva dentro de tu sitio web (requiere ayuda tecnica)."
          icon={<Code size={20} weight="duotone" />}
          label="Insertar en web"
          value={embedScript}
          onCopy={copyValue}
        />
        <DistributionCopy
          copied={copied}
          description="Mensaje listo para mandar a tus clientes por WhatsApp con el link de reserva."
          icon={<WhatsappLogo size={20} weight="duotone" />}
          label="Mensaje de WhatsApp"
          value={whatsappReply}
          onCopy={copyValue}
        />

        <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-raised)] p-3">
          <div className="flex items-center gap-2">
            <span className="text-[var(--accent)]">
              <QrCode size={20} weight="duotone" />
            </span>
            <div>
              <p className="text-sm font-semibold">QR para mesa o puerta</p>
              <p className="text-xs leading-5 text-[var(--muted-foreground)]">Descargalo desde el navegador o copia el link del QR.</p>
            </div>
          </div>
          <div className="grid place-items-center rounded-[var(--radius-sm)] bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={`QR de reservas para ${restaurantName}`} className="h-44 w-44" src={qrUrl} />
          </div>
          <Button size="sm" variant="secondary" onClick={() => copyValue("QR", qrUrl)}>
            <Copy size={15} weight="bold" />
            {copied === "QR" ? "Copiado" : "Copiar link QR"}
          </Button>
        </div>

        {copied === "error" ? <p className="text-xs text-[var(--danger)]">No pudimos copiar automaticamente.</p> : null}
      </div>
    </Panel>
  );
}

function DistributionCopy({
  copied,
  description,
  icon,
  label,
  value,
  onCopy
}: {
  copied: string;
  description: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy: (label: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-raised)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <span className="mt-0.5 shrink-0 text-[var(--accent)]">{icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">{description}</p>
          </div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onCopy(label, value)}>
          <Copy size={15} weight="bold" />
          {copied === label ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre className="max-h-28 overflow-auto rounded-[var(--radius-sm)] bg-[var(--muted)] p-3 text-xs leading-5 text-[var(--foreground)]">
        {value}
      </pre>
    </div>
  );
}

function ConfigOverview({ summary }: { summary?: Summary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard icon={<MapPin size={20} weight="duotone" />} label="Zonas" value={String(summary?.zones.length ?? 0)} />
      <MetricCard icon={<ForkKnife size={20} weight="duotone" />} label="Mesas" value={String(summary?.mesas.length ?? 0)} />
      <MetricCard icon={<StackPlus size={20} weight="duotone" />} label="Combos" value={String(summary?.seatingUnits.length ?? 0)} />
      <MetricCard icon={<Clock size={20} weight="duotone" />} label="Turnos" value={String(summary?.shifts.length ?? 0)} />
    </div>
  );
}

function ConfigForm({
  children,
  className,
  description,
  error,
  pending,
  title,
  onSubmit
}: {
  children: React.ReactNode;
  className?: string;
  description: string;
  error?: Error | null;
  pending?: boolean;
  title: string;
  onSubmit: (data: FormData) => void;
}) {
  return (
    <Panel className={className}>
      <div className="grid gap-4 p-4 sm:p-5">
        <div>
          <h3 className="text-2xl font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
        </div>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(new FormData(event.currentTarget));
            event.currentTarget.reset();
          }}
        >
          {children}
          {error ? <p className="text-sm text-[var(--danger)]">{error.message}</p> : null}
          <Button disabled={pending} type="submit">
            <Plus size={18} weight="bold" />
            Guardar
          </Button>
        </form>
      </div>
    </Panel>
  );
}

function ExistingList({ items, render }: { items: Row[]; render: (item: Row) => string }) {
  if (!items.length) {
    return <p className="rounded-[var(--radius-sm)] bg-[var(--muted)] p-3 text-sm text-[var(--muted-foreground)]">Todavia no hay registros.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.slice(0, 8).map((item) => (
        <Badge key={text(item, "id", render(item))}>{render(item)}</Badge>
      ))}
      {items.length > 8 ? <Badge>+{items.length - 8}</Badge> : null}
    </div>
  );
}

function Analytics({ summary }: { summary?: Summary }) {
  const timezone = text(summary?.restaurant, "timezone", "America/Argentina/Buenos_Aires");
  const today = DateTime.now().setZone(timezone);
  const [to, setTo] = useState(today.toISODate() ?? "");
  const [from, setFrom] = useState(today.minus({ days: 29 }).toISODate() ?? "");

  const analytics = useQuery({
    queryKey: ["admin-analytics", from, to],
    queryFn: () => api<AnalyticsResponse>(`/api/v1/admin/analytics?from=${from}&to=${to}`)
  });

  if (analytics.isLoading) {
    return (
      <Panel className="reveal-in">
        <div className="grid gap-4 p-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton className="h-24" key={index} />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </Panel>
    );
  }

  if (analytics.isError || !analytics.data) {
    return (
      <Panel>
        <div className="p-5">
          <EmptyState
            title="No pudimos cargar analitica"
            description="Reintenta la consulta. Si sigue fallando, la agenda sigue operativa mientras revisas la conexion."
            action={
              <Button variant="secondary" onClick={() => analytics.refetch()}>
                <ArrowsClockwise size={18} weight="bold" />
                Reintentar
              </Button>
            }
          />
        </div>
      </Panel>
    );
  }

  const data = analytics.data;
  const hasReservations = data.totals.reservations > 0;

  return (
    <div className="grid gap-4">
      <Panel className="reveal-in">
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <Badge className="gap-1 text-[var(--accent)]">
              <ChartLineUp size={14} weight="duotone" />
              {data.range.days} dias
            </Badge>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">Pulso del restaurante</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
              Reservas, ocupacion, canales y recurrencia calculados sobre las reservas de tu restaurante.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Desde">
              <input className={inputClassName} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </Field>
            <Field label="Hasta">
              <input className={inputClassName} type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </Field>
            <div className="flex items-end">
              <Button className="w-full" variant="secondary" onClick={() => analytics.refetch()}>
                <ArrowsClockwise size={18} weight="bold" />
                Actualizar
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={<CalendarDots size={20} weight="duotone" />} label="Reservas" value={formatInteger(data.totals.reservations)} />
        <MetricCard icon={<UsersThree size={20} weight="duotone" />} label="Cubiertos" value={formatInteger(data.totals.covers)} />
        <MetricCard icon={<ChartPieSlice size={20} weight="duotone" />} label="Ocupacion" value={formatPercent(data.totals.occupancyRate)} />
        <MetricCard icon={<WarningCircle size={20} weight="duotone" />} label="No-show" value={formatPercent(data.totals.noShowRate)} />
      </div>

      {!hasReservations ? (
        <Panel className="reveal-in">
          <div className="p-5">
            <EmptyState
              title="Todavia no hay datos en este rango"
              description="Cuando entren reservas, este tablero va a mostrar tendencias, horarios pico, clientes recurrentes y ocupacion del salon."
            />
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="grid gap-4">
          <Panel className="reveal-in overflow-hidden">
            <div className="border-b border-[var(--border)] p-4 sm:p-5">
              <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Tendencia diaria</p>
              <h3 className="mt-1 text-3xl font-semibold">Reservas y cubiertos</h3>
            </div>
            <DailyTrend data={data.daily} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="reveal-in reveal-delay-1">
              <div className="grid gap-4 p-4 sm:p-5">
                <SectionTitle eyebrow="Horas pico" title="Demanda por hora" />
                <HorizontalBars
                  emptyLabel="Sin horarios activos en el rango"
                  items={data.peakHours.map((hour) => ({
                    label: hour.label,
                    value: hour.reservations,
                    meta: `${hour.covers} cubiertos`
                  }))}
                />
              </div>
            </Panel>

            <Panel className="reveal-in reveal-delay-2">
              <div className="grid gap-4 p-4 sm:p-5">
                <SectionTitle eyebrow="Origen" title="Mix de canales" />
                <HorizontalBars
                  emptyLabel="Sin canales para mostrar"
                  items={data.sourceMix.map((source) => ({
                    label: sourceLabel(source.label),
                    value: source.value,
                    meta: `${source.covers ?? 0} cubiertos`
                  }))}
                />
              </div>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel className="reveal-in">
              <div className="grid gap-4 p-4 sm:p-5">
                <SectionTitle eyebrow="Zonas" title="Donde se reserva mas" />
                <HorizontalBars
                  emptyLabel="Sin zonas para mostrar"
                  items={data.topZones.map((zone) => ({
                    label: zone.label,
                    value: zone.value,
                    meta: `${zone.covers ?? 0} cubiertos`
                  }))}
                />
              </div>
            </Panel>

            <Panel className="reveal-in reveal-delay-1">
              <div className="grid gap-4 p-4 sm:p-5">
                <SectionTitle eyebrow="Servicios" title="Turnos mas fuertes" />
                <HorizontalBars
                  emptyLabel="Sin servicios para mostrar"
                  items={data.topServices.map((service) => ({
                    label: service.label,
                    value: service.value,
                    meta: `${service.covers ?? 0} cubiertos`
                  }))}
                />
              </div>
            </Panel>
          </div>
        </section>

        <aside className="grid gap-4 xl:sticky xl:top-4 xl:self-start">
          <Panel className="reveal-in reveal-delay-1">
            <div className="grid gap-4 p-4 sm:p-5">
              <SectionTitle eyebrow="Calidad" title="Salud operativa" />
              <DetailRow label="Reservas activas" value={formatInteger(data.totals.activeReservations)} />
              <DetailRow label="Cancelaciones" value={formatPercent(data.totals.cancellationRate)} />
              <DetailRow label="Clientes unicos" value={formatInteger(data.totals.uniqueCustomers)} />
              <DetailRow label="Duracion media" value={`${data.totals.avgTurnMinutes} min`} />
              <DetailRow label="Horas abiertas" value={formatDecimal(data.occupancy.openHours)} />
              <DetailRow label="Sillas activas" value={formatInteger(data.occupancy.seatCapacity)} />
            </div>
          </Panel>

          <Panel className="reveal-in reveal-delay-2">
            <div className="grid gap-4 p-4 sm:p-5">
              <SectionTitle eyebrow="Clientes" title="Nuevos vs recurrentes" />
              <HorizontalBars
                emptyLabel="Sin clientes activos"
                items={data.customerMix.map((segment) => ({
                  label: segment.label,
                  value: segment.value,
                  meta: "reservas"
                }))}
              />
            </div>
          </Panel>

          <Panel className="reveal-in reveal-delay-3">
            <div className="grid gap-4 p-4 sm:p-5">
              <SectionTitle eyebrow="Top clientes" title="Mayor frecuencia" />
              {data.topCustomers.length ? (
                <div className="grid gap-2">
                  {data.topCustomers.map((customer) => (
                    <div
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] p-3"
                      key={`${customer.phone}-${customer.name}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{customer.name}</p>
                          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{customer.phone}</p>
                        </div>
                        <Badge>{customer.reservations} reservas</Badge>
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{customer.covers} cubiertos acumulados</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">Sin clientes frecuentes en este rango.</p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{eyebrow}</p>
      <h3 className="mt-1 text-2xl font-semibold">{title}</h3>
    </div>
  );
}

function DailyTrend({ data }: { data: AnalyticsResponse["daily"] }) {
  const max = Math.max(1, ...data.map((row) => Math.max(row.reservations, row.covers)));
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] gap-3 p-4 sm:p-5">
        <div className="flex h-72 items-end gap-2 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--muted)_42%,transparent)] p-3">
          {data.map((row) => {
            const coversHeight = Math.max(4, (row.covers / max) * 100);
            const reservationsHeight = Math.max(4, (row.reservations / max) * 100);
            return (
              <div
                className="flex h-full min-w-5 flex-1 items-end justify-center gap-1"
                key={row.date}
                title={`${row.date}: ${row.reservations} reservas, ${row.covers} cubiertos`}
              >
                <div
                  className="mx-auto w-full max-w-7 rounded-t-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--accent)_38%,var(--muted))]"
                  style={{ height: `${coversHeight}%` }}
                />
                <div
                  className="mx-auto w-full max-w-7 rounded-t-[var(--radius-xs)] bg-[var(--accent)]"
                  style={{ height: `${reservationsHeight}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(1.25rem, 1fr))` }}>
          {data.map((row, index) => (
            <span className="truncate text-center font-mono text-[0.65rem] text-[var(--muted-foreground)]" key={row.date}>
              {index % labelEvery === 0 ? DateTime.fromISO(row.date).toFormat("dd/LL") : ""}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-[var(--accent)]" /> Reservas
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-5 rounded-full bg-[color-mix(in_srgb,var(--accent)_38%,var(--muted))]" /> Cubiertos
          </span>
        </div>
      </div>
    </div>
  );
}

function HorizontalBars({
  emptyLabel,
  items
}: {
  emptyLabel: string;
  items: Array<{ label: string; value: number; meta?: string }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  if (!items.length) return <p className="text-sm text-[var(--muted-foreground)]">{emptyLabel}</p>;

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const width = Math.max(4, (item.value / max) * 100);
        return (
          <div className="grid gap-1" key={item.label}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-semibold">{item.label}</span>
              <span className="font-mono text-xs text-[var(--muted-foreground)]">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--muted)]">
              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${width}%` }} />
            </div>
            {item.meta ? <span className="text-xs text-[var(--muted-foreground)]">{item.meta}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function sourceLabel(source: string) {
  if (source === "web") return "Web";
  if (source === "manual") return "Manual";
  if (source === "whatsapp") return "WhatsApp";
  return source;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function formatPercent(value: number) {
  return `${formatDecimal(value)}%`;
}

function Billing() {
  const billing = useQuery({
    queryKey: ["admin-billing"],
    queryFn: () => api<BillingResponse>("/api/v1/admin/billing")
  });
  const checkout = useMutation({
    mutationFn: (planKey: BillingPlan["key"]) =>
      api<{ url: string | null }>("/api/v1/admin/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planKey })
      }),
    onSuccess: (response) => {
      if (response.url) window.location.assign(response.url);
    }
  });
  const cancel = useMutation({
    mutationFn: () => api<{ subscription: Row | null }>("/api/v1/admin/billing/cancel", { method: "POST" }),
    onSuccess: () => billing.refetch()
  });

  if (billing.isLoading) {
    return (
      <Panel>
        <div className="grid gap-4 p-5">
          <Skeleton className="h-32" />
          <div className="grid gap-3 lg:grid-cols-3">
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
          </div>
        </div>
      </Panel>
    );
  }

  if (billing.isError || !billing.data) {
    return (
      <Panel>
        <div className="p-5">
          <EmptyState title="No pudimos cargar facturacion" description="Reintentá desde el panel antes de cambiar planes." />
        </div>
      </Panel>
    );
  }

  const subscription = billing.data.subscription;
  const currentPlan = text(subscription, "plan_key", "growth");
  const status = text(subscription, "status", "trialing");
  const paymentLink = text(subscription, "mercadopago_init_point");
  const hasMercadoPagoSubscription = Boolean(text(subscription, "mercadopago_preapproval_id"));
  const paidSubscription = status === "authorized" || status === "active";
  const mesaLimit = number(subscription, "mesa_limit");
  const reservationLimit = number(subscription, "monthly_reservation_limit");
  const mesaPercent = Math.min(100, Math.round((billing.data.usage.mesas / Math.max(1, mesaLimit)) * 100));
  const reservationPercent = Math.min(
    100,
    Math.round((billing.data.usage.reservationsThisMonth / Math.max(1, reservationLimit)) * 100)
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="grid gap-4">
        <Panel className="reveal-in">
          <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <Badge className={billing.data.usable ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                {billing.data.usable ? "Cuenta operativa" : "Facturacion requiere atencion"}
              </Badge>
              <h2 className="mt-4 text-4xl font-semibold leading-tight">Plan {currentPlan}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                La facturacion aplica al restaurante. El flujo del comensal se mantiene limpio y sin pagos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button disabled={!paymentLink} variant="secondary" onClick={() => window.location.assign(paymentLink)}>
                <CreditCard size={18} weight="bold" />
                Abrir Mercado Pago
              </Button>
              <Button disabled={!hasMercadoPagoSubscription || cancel.isPending} variant="ghost" onClick={() => cancel.mutate()}>
                <XCircle size={18} weight="bold" />
                Cancelar cobro
              </Button>
              <Button variant="ghost" onClick={() => billing.refetch()}>
                <ArrowsClockwise size={18} weight="bold" />
                Actualizar
              </Button>
            </div>
          </div>
        </Panel>

        <div className="grid gap-3 md:grid-cols-2">
          <UsageCard label="Mesas configuradas" limit={mesaLimit} percent={mesaPercent} value={billing.data.usage.mesas} />
          <UsageCard label="Reservas del mes" limit={reservationLimit} percent={reservationPercent} value={billing.data.usage.reservationsThisMonth} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {billing.data.plans.map((plan) => {
            const active = plan.key === currentPlan;
            const disabled = !billing.data.mercadoPagoConfigured || checkout.isPending || (active && paidSubscription);
            return (
              <Panel className={active ? "ring-2 ring-[color-mix(in_srgb,var(--accent)_45%,transparent)]" : ""} key={plan.key}>
                <div className="grid h-full content-between gap-5 p-4 sm:p-5">
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-3xl font-semibold">{plan.name}</h3>
                        <p className="mt-1 font-mono text-sm text-[var(--muted-foreground)]">{plan.priceLabel}</p>
                      </div>
                      {active ? <Badge className="text-[var(--accent)]">Actual</Badge> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-[var(--muted-foreground)]">{plan.description}</p>
                    <div className="mt-5 grid gap-2">
                      <Badge>{plan.mesaLimit} mesas</Badge>
                      <Badge>{plan.reservationLimit} reservas/mes</Badge>
                    </div>
                  </div>
                  <Button
                    disabled={disabled}
                    variant={active ? "secondary" : "primary"}
                    onClick={() => checkout.mutate(plan.key)}
                  >
                    <CreditCard size={18} weight="bold" />
                    {active && paidSubscription ? "Plan activo" : active ? "Activar cobro" : "Elegir plan"}
                  </Button>
                  {!billing.data.mercadoPagoConfigured ? (
                    <p className="text-xs text-[var(--warning)]">Falta configurar Mercado Pago para activar este plan.</p>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>

      <Panel className="reveal-in reveal-delay-2 xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-5 p-4 sm:p-5">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Estado Mercado Pago</p>
            <h3 className="mt-1 text-2xl font-semibold">{billing.data.mercadoPagoConfigured ? "Conectado" : "Pendiente"}</h3>
          </div>
          <div className="grid gap-3 text-sm">
            <DetailRow label="Estado" value={status} />
            <DetailRow label="Preapproval" value={text(subscription, "mercadopago_preapproval_id", "-")} />
            <DetailRow label="Payer" value={text(subscription, "mercadopago_payer_id", "-")} />
            <DetailRow label="Proximo cobro" value={text(subscription, "next_payment_at", text(subscription, "trial_ends_at", "-"))} />
          </div>
          {!billing.data.mercadoPagoConfigured ? (
            <div className="rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--warning)_12%,var(--card-raised))] p-3 text-sm leading-6 text-[var(--warning)]">
              Configura MP_ACCESS_TOKEN y MP_WEBHOOK_SECRET para activar suscripciones reales.
            </div>
          ) : null}
          {checkout.error ? <p className="text-sm text-[var(--danger)]">{checkout.error.message}</p> : null}
          {cancel.error ? <p className="text-sm text-[var(--danger)]">{cancel.error.message}</p> : null}
        </div>
      </Panel>
    </div>
  );
}

function UsageCard({ label, limit, percent, value }: { label: string; limit: number; percent: number; value: number }) {
  return (
    <Panel className="reveal-in">
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold">{label}</span>
          <Badge>{percent}%</Badge>
        </div>
        <div>
          <p className="font-mono text-3xl font-semibold tabular-nums">
            {value} / {limit}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--muted)]">
            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 py-3">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="min-w-0 truncate text-right font-semibold">{value}</span>
    </div>
  );
}

function LegalOps() {
  const queryClient = useQueryClient();
  const privacy = useQuery({
    queryKey: ["admin-privacy-requests"],
    queryFn: () => api<{ requests: Row[] }>("/api/v1/admin/privacy-requests")
  });
  const audit = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => api<{ audit: Row[] }>("/api/v1/admin/audit")
  });
  const updatePrivacy = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "rejected" }) =>
      api(`/api/v1/admin/privacy-requests/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-privacy-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-audit"] });
    }
  });

  const requests = privacy.data?.requests ?? [];
  const pending = requests.filter((request) => text(request, "status") === "pending").length;
  const auditRows = audit.data?.audit ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
      <Panel className="reveal-in xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Legal</p>
            <h2 className="mt-1 text-3xl font-semibold">Datos y auditoria</h2>
          </div>
          <div className="grid gap-2">
            <Badge>{pending} pendientes</Badge>
            <Badge>{requests.length} solicitudes</Badge>
            <Badge>{auditRows.length} acciones recientes</Badge>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4">
        <Panel className="reveal-in reveal-delay-1 overflow-hidden">
          <div className="border-b border-[var(--border)] p-4 sm:p-5">
            <h3 className="text-3xl font-semibold">Solicitudes de privacidad</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Exportacion, borrado y revision manual cuando el comensal no tiene sesion.</p>
          </div>
          <div className="grid gap-2 p-3 sm:p-4">
            {privacy.isLoading ? (
              Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-24" key={index} />)
            ) : requests.length ? (
              requests.map((request) => {
                const status = text(request, "status");
                return (
                  <article className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4 lg:grid-cols-[1fr_auto] lg:items-center" key={text(request, "id")}>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge>{text(request, "type") === "delete" ? "Borrado" : "Exportacion"}</Badge>
                        <Badge className={status === "pending" ? "text-[var(--warning)]" : status === "completed" ? "text-[var(--success)]" : "text-[var(--danger)]"}>
                          {status}
                        </Badge>
                      </div>
                      <h4 className="mt-2 text-lg font-semibold">{text(request, "customer_name", "Comensal sin vincular")}</h4>
                      <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                        {text(request, "email", "sin email")} - {text(request, "phone", "sin telefono")}
                      </p>
                      {text(request, "requester_note") ? <p className="mt-2 text-sm">{text(request, "requester_note")}</p> : null}
                      <p className="mt-2 font-mono text-xs text-[var(--muted-foreground)]">{text(request, "created_at")}</p>
                    </div>
                    {status === "pending" ? (
                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button size="sm" variant="secondary" disabled={updatePrivacy.isPending} onClick={() => updatePrivacy.mutate({ id: text(request, "id"), status: "completed" })}>
                          Completar
                        </Button>
                        <Button size="sm" variant="danger" disabled={updatePrivacy.isPending} onClick={() => updatePrivacy.mutate({ id: text(request, "id"), status: "rejected" })}>
                          Rechazar
                        </Button>
                      </div>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <EmptyState title="Sin solicitudes" description="Cuando un comensal pida exportacion o borrado, va a aparecer aca." />
            )}
          </div>
        </Panel>

        <Panel className="reveal-in reveal-delay-2 overflow-hidden">
          <div className="border-b border-[var(--border)] p-4 sm:p-5">
            <h3 className="text-3xl font-semibold">Auditoria staff</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Registro de cambios sensibles en reservas, clientes, settings y privacidad.</p>
          </div>
          <div className="grid gap-2 p-3 sm:p-4">
            {audit.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => <Skeleton className="h-16" key={index} />)
            ) : auditRows.length ? (
              auditRows.slice(0, 12).map((entry) => (
                <article className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card-raised)] p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={text(entry, "id")}>
                  <div>
                    <p className="font-semibold">{auditActionLabel(text(entry, "action"))}</p>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                      {text(entry, "staffEmail", "staff")} - {text(entry, "targetType", "sistema")}
                    </p>
                  </div>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">{text(entry, "createdAt")}</p>
                </article>
              ))
            ) : (
              <EmptyState title="Sin auditoria todavia" description="Las proximas acciones sensibles se registraran automaticamente." />
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "settings.update": "Settings actualizados",
    "reservation.manual_create": "Reserva manual creada",
    "reservation.update": "Reserva actualizada",
    "customer.update": "Cliente actualizado",
    "privacy_request.update": "Solicitud de privacidad actualizada"
  };
  return labels[action] ?? action;
}

function Customers() {
  const [search, setSearch] = useState("");
  const customers = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api<{ customers: Row[] }>(`/api/v1/admin/customers?search=${encodeURIComponent(search)}`)
  });

  const rows = customers.data?.customers ?? [];
  const vipCount = rows.filter((customer) => bool(customer, "vip")).length;
  const noShows = rows.reduce((sum, customer) => sum + number(customer, "no_show_count"), 0);

  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
      <Panel className="reveal-in xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-4 p-4 sm:p-5">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Clientes</p>
            <h2 className="mt-1 text-3xl font-semibold">Memoria del salon</h2>
          </div>
          <div className="grid gap-2">
            <Badge>{rows.length} resultados</Badge>
            <Badge>{vipCount} VIP</Badge>
            <Badge>{noShows} no-shows acumulados</Badge>
          </div>
        </div>
      </Panel>

      <Panel className="reveal-in reveal-delay-1 overflow-hidden">
        <div className="grid gap-4 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_20rem] sm:items-end sm:p-5">
          <div>
            <h3 className="text-3xl font-semibold">Base de clientes</h3>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">Busca por nombre, telefono o email.</p>
          </div>
          <label className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" size={17} weight="duotone" />
            <input
              className={`${inputClassName} pl-9`}
              placeholder="Buscar cliente"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-2 p-3 sm:p-4">
          {customers.isLoading ? (
            Array.from({ length: 6 }).map((_, index) => <Skeleton className="h-20" key={index} />)
          ) : customers.isError ? (
            <EmptyState title="No pudimos cargar clientes" description="Reintentá la busqueda o volve a ingresar al panel." />
          ) : rows.length ? (
            rows.map((customer) => (
              <article className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={text(customer, "id")}>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold">{text(customer, "name", "Sin nombre")}</h4>
                    {bool(customer, "vip") ? <Badge className="text-[var(--accent)]">VIP</Badge> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {text(customer, "phone")} - {text(customer, "email", "sin email")}
                  </p>
                  {text(customer, "notes") ? <p className="mt-2 text-sm">{text(customer, "notes")}</p> : null}
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <Badge>{text(customer, "visit_count", "0")} visitas</Badge>
                  <Badge>{text(customer, "no_show_count", "0")} no-show</Badge>
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="Sin clientes para esa busqueda" description="Probá con telefono, email o un fragmento del nombre." />
          )}
        </div>
      </Panel>
    </div>
  );
}
