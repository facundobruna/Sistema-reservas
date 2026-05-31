"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowsClockwise,
  ChartLineUp,
  Check,
  Crown,
  Flag,
  MagnifyingGlass,
  ShieldCheck,
  SignIn,
  SignOut,
  Storefront,
  UsersThree,
  WarningCircle
} from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Panel, Skeleton, inputClassName } from "@/components/ui/field";

type Tenant = {
  id: string;
  slug: string;
  name: string;
  timezone: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  planKey: "starter" | "growth" | "scale";
  billingStatus: string;
  reservations30: number;
  covers30: number;
  totalReservations: number;
  mesas: number;
  staffUsers: number;
  lastReservationAt: string | null;
  flags: Record<string, boolean>;
  mrrAmount: number;
};

type AuditLog = {
  id: string;
  action: string;
  restaurantId: string | null;
  restaurantName: string | null;
  adminEmail: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type Overview = {
  totals: {
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    mrrAmount: number;
    signups30: number;
    churn30: number;
    reservations30: number;
    covers30: number;
  };
  planMix: Array<{ label: string; value: number; mrrAmount: number }>;
  statusMix: Array<{ label: string; value: number }>;
  recentSignups: Array<{ date: string; tenants: number }>;
  recentAudit: AuditLog[];
};

type FeatureFlag = { key: string; label: string };

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

export function SuperAdminApp() {
  const queryClient = useQueryClient();
  const me = useQuery({
    queryKey: ["super-admin-me"],
    queryFn: () => api<{ superAdmin: { email: string; role: string } }>("/api/v1/super-admin/auth/me"),
    retry: false
  });

  const logout = useMutation({
    mutationFn: () => api("/api/v1/super-admin/auth/logout", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries()
  });

  if (me.isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--background)] p-4">
        <Panel className="w-full max-w-xl">
          <div className="grid gap-4 p-5">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-48" />
          </div>
        </Panel>
      </main>
    );
  }

  if (me.isError || !me.data) return <SuperAdminLogin onSuccess={() => me.refetch()} />;

  return (
    <main id="content" className="min-h-screen bg-[var(--background)] px-3 py-3 sm:px-5">
      <div className="mx-auto grid max-w-[96rem] gap-4">
        <header className="reveal-in surface-shell">
          <div className="surface-core overflow-hidden">
            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1 text-[var(--accent)]">
                    <Crown size={14} weight="duotone" />
                    Super-admin
                  </Badge>
                  <Badge>{me.data.superAdmin.email}</Badge>
                </div>
                <h1 className="mt-4 text-5xl font-semibold leading-none">Control del SaaS</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                  Tenants, facturacion, soporte, flags y auditoria en una consola interna separada del panel del restaurante.
                </p>
              </div>
              <Button variant="ghost" onClick={() => logout.mutate()}>
                <SignOut size={18} weight="bold" />
                Salir
              </Button>
            </div>
          </div>
        </header>
        <SuperAdminDashboard />
      </div>
    </main>
  );
}

function SuperAdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api("/api/v1/super-admin/auth/login", { method: "POST", body: JSON.stringify(body) }),
    onSuccess
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    login.mutate({
      email: String(data.get("email") ?? ""),
      password: String(data.get("password") ?? "")
    });
  }

  return (
    <main id="content" className="grid min-h-screen bg-[var(--background)] px-4 py-6 lg:place-items-center">
      <section className="surface-shell mx-auto grid w-full max-w-5xl">
        <div className="surface-core grid overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
          <aside className="relative hidden min-h-[34rem] content-between overflow-hidden bg-[#201611] p-8 text-[#fff7ec] lg:grid">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(211,135,82,0.28),transparent_22rem),radial-gradient(circle_at_75%_80%,rgba(255,247,236,0.1),transparent_18rem)]" />
            <div className="relative">
              <Badge className="border-white/15 bg-white/10 text-[#f1d6c2]">Mesa Clara interno</Badge>
              <h1 className="mt-6 max-w-sm text-5xl font-semibold leading-none">Operar soporte sin perder trazabilidad.</h1>
            </div>
            <div className="relative grid gap-3 text-sm text-[#e9d4c3]">
              <p>Suspensiones, flags e impersonacion quedan registrados en auditoria.</p>
              <p>En Docker local se puede entrar con las variables `SUPER_ADMIN_EMAIL` y `SUPER_ADMIN_PASSWORD`.</p>
            </div>
          </aside>

          <div className="p-5 sm:p-8">
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Ingreso interno</p>
            <h2 className="mt-2 text-4xl font-semibold leading-tight">Entrar al super-admin</h2>
            <form className="mt-7 grid gap-4" onSubmit={submit}>
              <Field label="Email">
                <input className={inputClassName} defaultValue="owner@mesa-clara.test" name="email" type="email" />
              </Field>
              <Field label="Password">
                <input className={inputClassName} defaultValue="superadmin123" name="password" type="password" />
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

function SuperAdminDashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const overview = useQuery({
    queryKey: ["super-admin-overview"],
    queryFn: () => api<Overview>("/api/v1/super-admin/overview")
  });
  const tenants = useQuery({
    queryKey: ["super-admin-tenants", search],
    queryFn: () => api<{ tenants: Tenant[]; featureFlags: FeatureFlag[] }>(`/api/v1/super-admin/tenants?search=${encodeURIComponent(search)}`)
  });
  const audit = useQuery({
    queryKey: ["super-admin-audit"],
    queryFn: () => api<{ audit: AuditLog[] }>("/api/v1/super-admin/audit")
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["super-admin-overview"] });
    queryClient.invalidateQueries({ queryKey: ["super-admin-tenants"] });
    queryClient.invalidateQueries({ queryKey: ["super-admin-audit"] });
  };

  const suspension = useMutation({
    mutationFn: ({ id, suspended }: { id: string; suspended: boolean }) =>
      api(`/api/v1/super-admin/tenants/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ suspended, reason: reasons[id] ?? null })
      }),
    onSuccess: refreshAll
  });

  const flag = useMutation({
    mutationFn: ({ id, key, enabled }: { id: string; key: string; enabled: boolean }) =>
      api(`/api/v1/super-admin/tenants/${id}/flags`, {
        method: "PATCH",
        body: JSON.stringify({ key, enabled })
      }),
    onSuccess: refreshAll
  });

  const impersonate = useMutation({
    mutationFn: (id: string) => api<{ url: string }>(`/api/v1/super-admin/tenants/${id}/impersonate`, { method: "POST" }),
    onSuccess: (response) => window.location.assign(response.url)
  });

  const tenantRows = tenants.data?.tenants ?? [];
  const featureFlags = tenants.data?.featureFlags ?? [];
  const busy = suspension.isPending || flag.isPending || impersonate.isPending;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {overview.isLoading || !overview.data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-28" key={index} />)
        ) : (
          <>
            <MetricCard icon={<Storefront size={20} weight="duotone" />} label="Tenants activos" value={`${overview.data.totals.activeTenants}/${overview.data.totals.tenants}`} />
            <MetricCard icon={<ChartLineUp size={20} weight="duotone" />} label="MRR estimado" value={money(overview.data.totals.mrrAmount)} />
            <MetricCard icon={<UsersThree size={20} weight="duotone" />} label="Cubiertos 30d" value={formatInteger(overview.data.totals.covers30)} />
            <MetricCard icon={<WarningCircle size={20} weight="duotone" />} label="Churn 30d" value={formatInteger(overview.data.totals.churn30)} />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="grid gap-4">
          <Panel className="reveal-in overflow-hidden">
            <div className="grid gap-4 border-b border-[var(--border)] p-4 sm:grid-cols-[1fr_20rem_auto] sm:items-end sm:p-5">
              <div>
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Tenants</p>
                <h2 className="mt-1 text-3xl font-semibold">Restaurantes y soporte</h2>
              </div>
              <label className="relative">
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" size={17} weight="duotone" />
                <input
                  className={`${inputClassName} pl-10`}
                  placeholder="Buscar por nombre o slug"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <Button variant="secondary" onClick={refreshAll}>
                <ArrowsClockwise size={18} weight="bold" />
                Actualizar
              </Button>
            </div>

            <div className="grid gap-3 p-3 sm:p-4">
              {tenants.isLoading ? (
                Array.from({ length: 4 }).map((_, index) => <Skeleton className="h-48" key={index} />)
              ) : tenants.isError ? (
                <EmptyState title="No pudimos cargar tenants" description="Reintenta antes de operar soporte o flags." />
              ) : tenantRows.length ? (
                tenantRows.map((tenant) => (
                  <TenantCard
                    busy={busy}
                    featureFlags={featureFlags}
                    key={tenant.id}
                    onFlag={(key, enabled) => flag.mutate({ id: tenant.id, key, enabled })}
                    onImpersonate={() => impersonate.mutate(tenant.id)}
                    onReason={(reason) => setReasons((current) => ({ ...current, [tenant.id]: reason }))}
                    onSuspend={(suspended) => suspension.mutate({ id: tenant.id, suspended })}
                    reason={reasons[tenant.id] ?? tenant.suspendedReason ?? ""}
                    tenant={tenant}
                  />
                ))
              ) : (
                <EmptyState title="Sin tenants para esa busqueda" description="Probá con otro nombre, slug o limpiá el filtro." />
              )}
            </div>
          </Panel>
        </section>

        <aside className="grid gap-4 xl:sticky xl:top-4 xl:self-start">
          <Panel className="reveal-in reveal-delay-1">
            <div className="grid gap-4 p-4 sm:p-5">
              <SectionTitle eyebrow="Mix comercial" title="Planes y estados" />
              {overview.data ? (
                <>
                  <HorizontalBars
                    emptyLabel="Sin planes"
                    items={overview.data.planMix.map((plan) => ({
                      label: plan.label,
                      value: plan.value,
                      meta: money(plan.mrrAmount)
                    }))}
                  />
                  <div className="border-t border-[var(--border)] pt-4">
                    <HorizontalBars
                      emptyLabel="Sin estados"
                      items={overview.data.statusMix.map((status) => ({ label: status.label, value: status.value }))}
                    />
                  </div>
                </>
              ) : (
                <Skeleton className="h-56" />
              )}
            </div>
          </Panel>

          <Panel className="reveal-in reveal-delay-2">
            <div className="grid gap-4 p-4 sm:p-5">
              <SectionTitle eyebrow="Auditoria" title="Ultimas acciones" />
              {audit.isLoading ? (
                <Skeleton className="h-64" />
              ) : (audit.data?.audit ?? []).length ? (
                <div className="grid gap-2">
                  {(audit.data?.audit ?? []).slice(0, 8).map((entry) => (
                    <article className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] p-3" key={entry.id}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-semibold">{auditLabel(entry.action)}</p>
                        <Badge>{formatDateTime(entry.createdAt)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {entry.restaurantName ?? "Sistema"} · {entry.adminEmail ?? "admin"}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted-foreground)]">Todavia no hay acciones auditadas.</p>
              )}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function TenantCard({
  busy,
  featureFlags,
  onFlag,
  onImpersonate,
  onReason,
  onSuspend,
  reason,
  tenant
}: {
  busy: boolean;
  featureFlags: FeatureFlag[];
  onFlag: (key: string, enabled: boolean) => void;
  onImpersonate: () => void;
  onReason: (reason: string) => void;
  onSuspend: (suspended: boolean) => void;
  reason: string;
  tenant: Tenant;
}) {
  const suspended = Boolean(tenant.suspendedAt);

  return (
    <article className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--card-raised)_88%,transparent)] p-4 lg:grid-cols-[1fr_20rem]">
      <div className="grid gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-2xl font-semibold">{tenant.name}</h3>
              <Badge className={suspended ? "text-[var(--danger)]" : "text-[var(--success)]"}>{suspended ? "Suspendido" : "Activo"}</Badge>
              <Badge>{tenant.planKey}</Badge>
              <Badge>{tenant.billingStatus}</Badge>
            </div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">/{tenant.slug} · {tenant.timezone}</p>
          </div>
          <Button disabled={busy} variant="secondary" onClick={onImpersonate}>
            <SignIn size={18} weight="bold" />
            Impersonar
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-4">
          <MiniStat label="MRR" value={money(tenant.mrrAmount)} />
          <MiniStat label="Reservas 30d" value={formatInteger(tenant.reservations30)} />
          <MiniStat label="Cubiertos 30d" value={formatInteger(tenant.covers30)} />
          <MiniStat label="Mesas" value={formatInteger(tenant.mesas)} />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Motivo de suspension">
            <input
              className={inputClassName}
              placeholder="Ej: deuda vencida, soporte o abuso"
              value={reason}
              onChange={(event) => onReason(event.target.value)}
            />
          </Field>
          <div className="flex items-end gap-2">
            {suspended ? (
              <Button className="w-full" disabled={busy} variant="secondary" onClick={() => onSuspend(false)}>
                <ShieldCheck size={18} weight="bold" />
                Reactivar
              </Button>
            ) : (
              <Button className="w-full" disabled={busy} variant="danger" onClick={() => onSuspend(true)}>
                <WarningCircle size={18} weight="bold" />
                Suspender
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid content-start gap-3 rounded-[var(--radius-md)] bg-[var(--muted)] p-3">
        <div className="flex items-center gap-2">
          <Flag size={18} weight="duotone" className="text-[var(--accent)]" />
          <p className="font-semibold">Feature flags</p>
        </div>
        <div className="grid gap-2">
          {featureFlags.map((featureFlag) => (
            <label
              className="flex min-h-10 items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 text-sm"
              key={featureFlag.key}
            >
              <span className="font-semibold">{featureFlag.label}</span>
              <input
                checked={Boolean(tenant.flags[featureFlag.key])}
                disabled={busy}
                type="checkbox"
                onChange={(event) => onFlag(featureFlag.key, event.target.checked)}
              />
            </label>
          ))}
        </div>
      </div>
    </article>
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] p-3">
      <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
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

function auditLabel(action: string) {
  if (action === "tenant.suspend") return "Suspension";
  if (action === "tenant.reactivate") return "Reactivacion";
  if (action === "tenant.impersonate") return "Impersonacion";
  if (action === "feature_flag.update") return "Flag actualizado";
  return action;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = DateTime.fromISO(value);
  return parsed.isValid ? parsed.toFormat("dd/LL HH:mm") : value;
}
