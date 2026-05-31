"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDots, Check, GearSix, SignOut, UsersThree } from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Panel, inputClassName } from "@/components/ui/field";

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

function text(row: Row, key: string, fallback = "") {
  const value = row[key];
  return value === null || value === undefined ? fallback : String(value);
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
  const [tab, setTab] = useState<"agenda" | "config" | "customers">("agenda");
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

  return (
    <main id="content" className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Admin</p>
            <h1 className="text-lg font-semibold">Panel del restaurante</h1>
          </div>
          <Button size="sm" variant="ghost" onClick={() => logout.mutate()}>
            <SignOut size={16} weight="bold" />
            Salir
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5">
        <nav className="flex gap-2 overflow-x-auto">
          <TabButton active={tab === "agenda"} icon={<CalendarDots size={16} weight="duotone" />} onClick={() => setTab("agenda")}>
            Agenda
          </TabButton>
          <TabButton active={tab === "config"} icon={<GearSix size={16} weight="duotone" />} onClick={() => setTab("config")}>
            Configuracion
          </TabButton>
          <TabButton active={tab === "customers"} icon={<UsersThree size={16} weight="duotone" />} onClick={() => setTab("customers")}>
            Clientes
          </TabButton>
        </nav>

        {tab === "agenda" ? <Agenda date={date} setDate={setDate} summary={summary.data} /> : null}
        {tab === "config" ? <Config summary={summary.data} refresh={() => summary.refetch()} /> : null}
        {tab === "customers" ? <Customers /> : null}
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
    <main id="content" className="grid min-h-screen place-items-center px-4">
      <Panel className="w-full max-w-md p-5">
        <h1 className="text-2xl font-semibold">Ingresar al panel</h1>
        <form className="mt-5 grid gap-4" onSubmit={submit}>
          <Field label="Restaurante">
            <input className={inputClassName} defaultValue="demo-bistro" name="restaurantSlug" />
          </Field>
          <Field label="Email">
            <input className={inputClassName} defaultValue="owner@demo-bistro.test" name="email" type="email" />
          </Field>
          <Field label="Password">
            <input className={inputClassName} defaultValue="admin123" name="password" type="password" />
          </Field>
          {login.error ? <p className="text-sm text-[var(--danger)]">{login.error.message}</p> : null}
          <Button disabled={login.isPending} type="submit">
            <Check size={18} weight="bold" />
            Ingresar
          </Button>
        </form>
      </Panel>
    </main>
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
    <Button variant={active ? "primary" : "secondary"} onClick={onClick}>
      {icon}
      {children}
    </Button>
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
  const reservations = useQuery({
    queryKey: ["admin-reservations", date],
    queryFn: () => api<{ reservations: Row[] }>(`/api/v1/admin/reservations?date=${date}`),
    refetchInterval: 20_000
  });
  const transition = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api(`/api/v1/admin/reservations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });
  const manual = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/api/v1/admin/reservations", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reservations"] })
  });

  function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const timezone = text(summary?.restaurant ?? {}, "timezone", "America/Argentina/Buenos_Aires");
    const time = DateTime.fromISO(`${date}T${String(data.get("time"))}`, { zone: timezone }).toISO() ?? "";
    manual.mutate({
      date,
      time,
      partySize: Number(data.get("partySize") ?? 2),
      zoneId: String(data.get("zoneId") || "") || null,
      serviceId: String(data.get("serviceId") || "") || null,
      customer: {
        name: String(data.get("name") ?? ""),
        email: String(data.get("email") || "") || null,
        phone: String(data.get("phone") ?? "")
      },
      specialRequests: String(data.get("specialRequests") || "") || null,
      source: "manual"
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <h2 className="text-xl font-semibold">Agenda</h2>
          <input className={`${inputClassName} max-w-44`} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead className="bg-[var(--muted)] text-left text-[var(--muted-foreground)]">
              <tr>
                <th className="p-3">Hora</th>
                <th className="p-3">Cliente</th>
                <th className="p-3">Mesa</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservations.data?.reservations.map((row) => (
                <tr className="border-t border-[var(--border)]" key={text(row, "id")}>
                  <td className="p-3 font-mono">{DateTime.fromISO(text(row, "starts_at")).toFormat("HH:mm")}</td>
                  <td className="p-3">
                    <div className="font-medium">{text(row, "customer_name")}</div>
                    <div className="text-xs text-[var(--muted-foreground)]">{text(row, "customer_phone")}</div>
                  </td>
                  <td className="p-3">{text(row, "seating_unit_name", "-")}</td>
                  <td className="p-3"><Badge>{text(row, "status")}</Badge></td>
                  <td className="flex gap-2 p-3">
                    {["seated", "completed", "cancelled", "no_show"].map((status) => (
                      <Button key={status} size="sm" variant={status === "cancelled" || status === "no_show" ? "danger" : "secondary"} onClick={() => transition.mutate({ id: text(row, "id"), status })}>
                        {status}
                      </Button>
                    ))}
                  </td>
                </tr>
              ))}
              {!reservations.data?.reservations.length ? (
                <tr>
                  <td className="p-5 text-[var(--muted-foreground)]" colSpan={5}>
                    Sin reservas para esta fecha.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="p-4">
        <h3 className="text-lg font-semibold">Alta manual</h3>
        <form className="mt-4 grid gap-3" onSubmit={submitManual}>
          <Field label="Hora"><input className={inputClassName} name="time" required type="time" /></Field>
          <Field label="Comensales"><input className={inputClassName} defaultValue={2} min={1} name="partySize" type="number" /></Field>
          <Field label="Servicio">
            <select className={inputClassName} name="serviceId">
              {summary?.services.map((service) => <option key={text(service, "id")} value={text(service, "id")}>{text(service, "name")}</option>)}
            </select>
          </Field>
          <Field label="Zona">
            <select className={inputClassName} name="zoneId">
              <option value="">Cualquiera</option>
              {summary?.zones.map((zone) => <option key={text(zone, "id")} value={text(zone, "id")}>{text(zone, "name")}</option>)}
            </select>
          </Field>
          <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
          <Field label="Telefono"><input className={inputClassName} name="phone" required /></Field>
          <Field label="Email"><input className={inputClassName} name="email" type="email" /></Field>
          <Field label="Notas"><textarea className={`${inputClassName} min-h-24 py-3`} name="specialRequests" /></Field>
          {manual.error ? <p className="text-sm text-[var(--danger)]">{manual.error.message}</p> : null}
          <Button disabled={manual.isPending} type="submit">Crear</Button>
        </form>
      </Panel>
    </div>
  );
}

function Config({ summary, refresh }: { summary?: Summary; refresh: () => void }) {
  const create = useMutation({
    mutationFn: ({ path, body }: { path: string; body: Record<string, unknown> }) =>
      api(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: refresh
  });

  function submit(path: string, body: Record<string, unknown>) {
    create.mutate({ path, body });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ConfigForm title="Zona" onSubmit={(data) => submit("/api/v1/admin/zones", { name: data.get("name"), position: Number(data.get("position") ?? 0) })}>
        <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
        <Field label="Orden"><input className={inputClassName} defaultValue={0} name="position" type="number" /></Field>
      </ConfigForm>

      <ConfigForm title="Mesa" onSubmit={(data) => submit("/api/v1/admin/mesas", { name: data.get("name"), zoneId: data.get("zoneId"), minCapacity: Number(data.get("minCapacity") ?? 1), maxCapacity: Number(data.get("maxCapacity") ?? 2), active: true })}>
        <Field label="Zona"><select className={inputClassName} name="zoneId">{summary?.zones.map((zone) => <option key={text(zone, "id")} value={text(zone, "id")}>{text(zone, "name")}</option>)}</select></Field>
        <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min"><input className={inputClassName} defaultValue={1} name="minCapacity" type="number" /></Field>
          <Field label="Max"><input className={inputClassName} defaultValue={2} name="maxCapacity" type="number" /></Field>
        </div>
      </ConfigForm>

      <ConfigForm title="Servicio" onSubmit={(data) => submit("/api/v1/admin/services", { name: data.get("name"), position: Number(data.get("position") ?? 0) })}>
        <Field label="Nombre"><input className={inputClassName} name="name" required /></Field>
        <Field label="Orden"><input className={inputClassName} defaultValue={0} name="position" type="number" /></Field>
      </ConfigForm>

      <ConfigForm title="Turno" onSubmit={(data) => submit("/api/v1/admin/shifts", { serviceId: data.get("serviceId"), zoneId: String(data.get("zoneId") || "") || null, dayOfWeek: Number(data.get("dayOfWeek") ?? 0), startTime: data.get("startTime"), endTime: data.get("endTime"), slotIntervalMin: Number(data.get("slotIntervalMin") ?? 30), turnDurationMin: Number(data.get("turnDurationMin") ?? 90), seatingMode: data.get("seatingMode"), fixedTimes: String(data.get("fixedTimes") || "").split(",").map((item) => item.trim()).filter(Boolean), pacingCap: String(data.get("pacingCap") || "") ? Number(data.get("pacingCap")) : null })}>
        <Field label="Servicio"><select className={inputClassName} name="serviceId">{summary?.services.map((service) => <option key={text(service, "id")} value={text(service, "id")}>{text(service, "name")}</option>)}</select></Field>
        <Field label="Zona"><select className={inputClassName} name="zoneId"><option value="">Todas</option>{summary?.zones.map((zone) => <option key={text(zone, "id")} value={text(zone, "id")}>{text(zone, "name")}</option>)}</select></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Dia"><input className={inputClassName} defaultValue={0} max={6} min={0} name="dayOfWeek" type="number" /></Field>
          <Field label="Inicio"><input className={inputClassName} name="startTime" required type="time" /></Field>
          <Field label="Fin"><input className={inputClassName} name="endTime" required type="time" /></Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Intervalo"><input className={inputClassName} defaultValue={30} name="slotIntervalMin" type="number" /></Field>
          <Field label="Duracion"><input className={inputClassName} defaultValue={90} name="turnDurationMin" type="number" /></Field>
          <Field label="Pacing"><input className={inputClassName} name="pacingCap" type="number" /></Field>
        </div>
        <Field label="Modo"><select className={inputClassName} name="seatingMode"><option value="rolling">Rolling</option><option value="fixed">Fixed</option></select></Field>
        <Field label="Horarios fijos"><input className={inputClassName} name="fixedTimes" placeholder="12:00,13:30" /></Field>
      </ConfigForm>

      <ConfigForm title="Excepcion" onSubmit={(data) => submit("/api/v1/admin/exceptions", { date: data.get("date"), kind: data.get("kind"), startTime: String(data.get("startTime") || "") || null, endTime: String(data.get("endTime") || "") || null, note: String(data.get("note") || "") || null })}>
        <Field label="Fecha"><input className={inputClassName} name="date" required type="date" /></Field>
        <Field label="Tipo"><select className={inputClassName} name="kind"><option value="closed">Cerrado</option><option value="special_hours">Horario especial</option></select></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Inicio"><input className={inputClassName} name="startTime" type="time" /></Field>
          <Field label="Fin"><input className={inputClassName} name="endTime" type="time" /></Field>
        </div>
        <Field label="Nota"><input className={inputClassName} name="note" /></Field>
      </ConfigForm>

      <Panel className="p-4 lg:col-span-3">
        <h3 className="text-lg font-semibold">Resumen</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Badge>{summary?.zones.length ?? 0} zonas</Badge>
          <Badge>{summary?.mesas.length ?? 0} mesas</Badge>
          <Badge>{summary?.seatingUnits.length ?? 0} unidades</Badge>
        </div>
      </Panel>
    </div>
  );
}

function ConfigForm({ title, children, onSubmit }: { title: string; children: React.ReactNode; onSubmit: (data: FormData) => void }) {
  return (
    <Panel className="p-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
          event.currentTarget.reset();
        }}
      >
        {children}
        <Button type="submit">Guardar</Button>
      </form>
    </Panel>
  );
}

function Customers() {
  const [search, setSearch] = useState("");
  const customers = useQuery({
    queryKey: ["customers", search],
    queryFn: () => api<{ customers: Row[] }>(`/api/v1/admin/customers?search=${encodeURIComponent(search)}`)
  });
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] p-4">
        <h2 className="text-xl font-semibold">Clientes</h2>
        <input className={`${inputClassName} max-w-72`} placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="grid divide-y divide-[var(--border)]">
        {customers.data?.customers.map((customer) => (
          <div className="grid gap-1 p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={text(customer, "id")}>
            <div>
              <div className="font-medium">{text(customer, "name", "Sin nombre")}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{text(customer, "phone")} · {text(customer, "email")}</div>
            </div>
            <div className="flex gap-2">
              {text(customer, "vip") === "true" ? <Badge>VIP</Badge> : null}
              <Badge>{text(customer, "no_show_count", "0")} no-show</Badge>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
