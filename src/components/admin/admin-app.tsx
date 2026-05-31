"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowsClockwise,
  CalendarDots,
  Check,
  CheckCircle,
  Clock,
  ClipboardText,
  ForkKnife,
  GearSix,
  MagnifyingGlass,
  MapPin,
  Plus,
  SignOut,
  StackPlus,
  Storefront,
  UsersThree,
  WarningCircle,
  XCircle
} from "@phosphor-icons/react";
import { DateTime } from "luxon";
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

type Tab = "agenda" | "config" | "customers";

const statuses = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const;
type ReservationStatus = (typeof statuses)[number];

const statusCopy: Record<ReservationStatus, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "border-[color-mix(in_srgb,var(--warning)_40%,var(--border))] text-[var(--warning)]" },
  confirmed: { label: "Confirmada", tone: "border-[color-mix(in_srgb,var(--accent)_42%,var(--border))] text-[var(--accent)]" },
  seated: { label: "Sentada", tone: "border-[color-mix(in_srgb,var(--success)_42%,var(--border))] text-[var(--success)]" },
  completed: { label: "Completada", tone: "border-[color-mix(in_srgb,var(--success)_30%,var(--border))] text-[var(--muted-foreground)]" },
  cancelled: { label: "Cancelada", tone: "border-[color-mix(in_srgb,var(--danger)_34%,var(--border))] text-[var(--danger)]" },
  no_show: { label: "No-show", tone: "border-[color-mix(in_srgb,var(--danger)_48%,var(--border))] text-[var(--danger)]" }
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
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("agenda");
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
                    Staff
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
            </nav>
          </div>
        </header>

        {summary.isLoading ? <PanelSkeleton /> : null}
        {tab === "agenda" && !summary.isLoading ? <Agenda date={date} setDate={setDate} summary={summary.data} /> : null}
        {tab === "config" && !summary.isLoading ? <Config summary={summary.data} refresh={() => summary.refetch()} /> : null}
        {tab === "customers" && !summary.isLoading ? <Customers /> : null}
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
              <Badge className="border-white/15 bg-white/10 text-[#f1d6c2]">Reservas SaaS</Badge>
              <h1 className="mt-6 max-w-sm text-5xl font-semibold leading-none">Control del salon sin ruido.</h1>
            </div>
            <div className="relative grid gap-3 text-sm text-[#e9d4c3]">
              <p>Agenda, configuracion y clientes en una misma consola operativa.</p>
              <p>Demo lista para probar: `demo-bistro`, `owner@demo-bistro.test`, `admin123`.</p>
            </div>
          </aside>

          <div className="p-5 sm:p-8">
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Ingreso staff</p>
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

  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ReservationStatus }) =>
      api(`/api/v1/admin/reservations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });

  const manual = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/admin/reservations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });

  const rows = useMemo(() => reservations.data?.reservations ?? [], [reservations.data?.reservations]);
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
      { status: "no_show" as const, label: "No-show", variant: "secondary" as const, icon: <WarningCircle size={15} weight="bold" /> }
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
            description="Cada mesa crea automaticamente su unidad single para el motor."
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
            description="Combina mesas solo cuando haga falta para grupos grandes."
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
            description="Define ventanas de disponibilidad, duracion de mesa, intervalos y pacing."
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
                seatingMode: data.get("seatingMode"),
                fixedTimes: String(data.get("fixedTimes") || "").split(",").map((item) => item.trim()).filter(Boolean),
                pacingCap: String(data.get("pacingCap") || "") ? Number(data.get("pacingCap")) : null
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
              <Field label="Pacing"><input className={inputClassName} name="pacingCap" type="number" /></Field>
              <Field label="Modo"><select className={inputClassName} name="seatingMode"><option value="rolling">Rolling</option><option value="fixed">Fixed</option></select></Field>
            </div>
            <Field label="Horarios fijos"><input className={inputClassName} name="fixedTimes" placeholder="12:00, 13:30" /></Field>
            <ExistingList items={summary?.shifts ?? []} render={(shift) => `${dayNames[number(shift, "dayOfWeek")]} ${text(shift, "startTime")} - ${text(shift, "endTime")}`} />
          </ConfigForm>

          <ConfigForm
            className="lg:col-span-2"
            description="Cierres o ventanas especiales para fechas puntuales."
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
            <ExistingList items={summary?.exceptions ?? []} render={(item) => `${text(item, "date")} - ${text(item, "kind")}`} />
          </ConfigForm>
        </div>
      </section>

      <Panel className="reveal-in reveal-delay-2 xl:sticky xl:top-4 xl:self-start">
        <div className="grid gap-5 p-4 sm:p-5">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Identidad publica</p>
            <h3 className="mt-1 text-2xl font-semibold">Branding del restaurante</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Estos datos alimentan el booking publico sin bifurcar el producto.
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
    </div>
  );
}

function ConfigOverview({ summary }: { summary?: Summary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard icon={<MapPin size={20} weight="duotone" />} label="Zonas" value={String(summary?.zones.length ?? 0)} />
      <MetricCard icon={<ForkKnife size={20} weight="duotone" />} label="Mesas" value={String(summary?.mesas.length ?? 0)} />
      <MetricCard icon={<StackPlus size={20} weight="duotone" />} label="Unidades" value={String(summary?.seatingUnits.length ?? 0)} />
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
