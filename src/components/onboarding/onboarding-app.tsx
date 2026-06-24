"use client";

import {
  ArrowRight,
  CalendarDots,
  CheckCircle,
  ClipboardText,
  Clock,
  ForkKnife,
  LinkSimple,
  MapPin,
  PaintBrush,
  StackPlus,
  Storefront,
  UsersThree
} from "@phosphor-icons/react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, Field, Panel, inputClassName } from "@/components/ui/field";

type TableProfile = "small" | "medium" | "large";

type FormState = {
  restaurantName: string;
  slug: string;
  timezone: string;
  ownerName: string;
  ownerEmail: string;
  password: string;
  accent: string;
  heroImageUrl: string;
  logoUrl: string;
  zoneNames: string;
  tableProfile: TableProfile;
  lunchEnabled: boolean;
  dinnerEnabled: boolean;
  lunchStart: string;
  lunchEnd: string;
  dinnerStart: string;
  dinnerEnd: string;
  slotIntervalMin: number;
  turnDurationMin: number;
  pacingCap: string;
};

type OnboardingResponse = {
  restaurant: { id: string; name: string; slug: string };
  staff: { id: string; email: string; name: string };
  counts: { zones: number; mesas: number; services: number; shifts: number };
  links: {
    bookingUrl: string;
    adminUrl: string;
    embedUrl: string;
    iframe: string;
    script: string;
  };
};

const steps = ["Identidad", "Salon", "Servicios", "Publicar"] as const;

const tableProfiles: Record<TableProfile, { label: string; description: string; mesas: number }> = {
  small: { label: "Bistro", description: "9 mesas: salon simple, listo en minutos.", mesas: 9 },
  medium: { label: "Restaurante", description: "16 mesas para operar almuerzo y cena.", mesas: 16 },
  large: { label: "Salon amplio", description: "28 mesas con mas capacidad y pacing.", mesas: 28 }
};

const initialState: FormState = {
  restaurantName: "",
  slug: "",
  timezone: "America/Argentina/Buenos_Aires",
  ownerName: "",
  ownerEmail: "",
  password: "",
  accent: "#8e3f24",
  heroImageUrl: "",
  logoUrl: "",
  zoneNames: "Salon principal, Patio",
  tableProfile: "small",
  lunchEnabled: true,
  dinnerEnabled: true,
  lunchStart: "12:00",
  lunchEnd: "15:00",
  dinnerStart: "19:30",
  dinnerEnd: "23:30",
  slotIntervalMin: 30,
  turnDurationMin: 90,
  pacingCap: ""
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 64);
}

async function createTenant(body: Record<string, unknown>) {
  const response = await fetch("/api/v1/onboarding/restaurant", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(error.message ?? "No pudimos crear el restaurante");
  }
  return (await response.json()) as OnboardingResponse;
}

export function OnboardingApp() {
  const [form, setForm] = useState<FormState>(initialState);
  const [step, setStep] = useState(0);
  const [slugTouched, setSlugTouched] = useState(false);
  const [result, setResult] = useState<OnboardingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const zoneList = useMemo(() => form.zoneNames.split(",").map((item) => item.trim()).filter(Boolean), [form.zoneNames]);
  const currentProfile = tableProfiles[form.tableProfile];
  const canContinue =
    step === 0
      ? Boolean(form.restaurantName && form.slug && form.ownerName && form.ownerEmail && form.password.length >= 8)
      : step === 1
        ? zoneList.length > 0
        : step === 2
          ? form.lunchEnabled || form.dinnerEnabled
          : true;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateName(value: string) {
    setForm((current) => ({
      ...current,
      restaurantName: value,
      slug: slugTouched ? current.slug : slugify(value)
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    setPending(true);
    setError(null);
    try {
      const created = await createTenant({
        ...form,
        slug: slugify(form.slug),
        zoneNames: zoneList,
        heroImageUrl: form.heroImageUrl || null,
        logoUrl: form.logoUrl || null,
        pacingCap: form.pacingCap ? Number(form.pacingCap) : null
      });
      setResult(created);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos crear el restaurante");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return <OnboardingSuccess result={result} />;
  }

  return (
    <main id="content" className="min-h-screen bg-[var(--background)] px-4 py-4 sm:px-6 lg:py-6">
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[0.86fr_1.14fr]">
        <aside className="reveal-in surface-shell lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <div className="surface-core grid h-full overflow-hidden">
            <div className="relative grid min-h-80 content-between overflow-hidden rounded-[calc(var(--radius-xl)-0.375rem)] bg-[#261913] p-6 text-[#fff7ec] sm:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(211,135,82,0.28),transparent_22rem),radial-gradient(circle_at_86%_78%,rgba(255,247,236,0.13),transparent_24rem)]" />
              <div className="relative">
                <Badge className="border-white/15 bg-white/10 text-[#f1d6c2]">Alta de restaurante</Badge>
                <h1 className="mt-6 max-w-xl text-5xl font-semibold leading-none md:text-6xl">
                  Tu restaurante operativo antes de abrir el turno.
                </h1>
                <p className="mt-5 max-w-md text-sm leading-7 text-[#ead8ca]">
                  En pocos pasos tu restaurante queda listo para recibir reservas. Despues podes ajustar todo desde el panel.
                </p>
              </div>

              <div className="relative grid gap-2">
                {steps.map((item, index) => (
                  <div className="grid grid-cols-[2rem_1fr] items-center gap-3" key={item}>
                    <span className={`grid h-8 w-8 place-items-center rounded-[var(--radius-xs)] ${index <= step ? "bg-[#fff7ec] text-[#261913]" : "bg-white/10 text-[#ead8ca]"}`}>
                      {index < step ? <CheckCircle size={16} weight="fill" /> : index + 1}
                    </span>
                    <span className={index <= step ? "font-semibold text-[#fff7ec]" : "text-sm text-[#d8c2b1]"}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <Panel className="reveal-in reveal-delay-1 min-h-[calc(100dvh-2rem)] overflow-hidden lg:min-h-[calc(100dvh-3rem)]">
          <form className="grid min-h-[calc(100dvh-2.75rem)] content-between" onSubmit={submit}>
            <header className="border-b border-[var(--border)] p-4 sm:p-6">
              <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">
                Paso {step + 1} / {steps.length}
              </p>
              <h2 className="mt-1 text-4xl font-semibold leading-tight">{steps[step]}</h2>
            </header>

            <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_18rem]">
              <div className="min-h-[30rem]">
                {step === 0 ? <IdentityStep form={form} setSlugTouched={setSlugTouched} update={update} updateName={updateName} /> : null}
                {step === 1 ? <RoomStep form={form} update={update} zoneList={zoneList} /> : null}
                {step === 2 ? <ServicesStep form={form} update={update} /> : null}
                {step === 3 ? <PublishStep currentProfile={currentProfile} form={form} zoneList={zoneList} /> : null}
              </div>

              <aside className="grid content-start gap-3 rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--muted)_46%,transparent)] p-4">
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Resumen</p>
                <SummaryItem icon={<Storefront size={17} weight="duotone" />} label="Restaurante" value={form.restaurantName || "Sin nombre"} />
                <SummaryItem icon={<LinkSimple size={17} weight="duotone" />} label="Link" value={form.slug || "-"} />
                <SummaryItem icon={<MapPin size={17} weight="duotone" />} label="Zonas" value={String(zoneList.length)} />
                <SummaryItem icon={<ForkKnife size={17} weight="duotone" />} label="Mesas" value={String(currentProfile.mesas)} />
                <SummaryItem icon={<Clock size={17} weight="duotone" />} label="Turno" value={`${form.turnDurationMin} min`} />
              </aside>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] p-4 sm:p-6">
              <Button disabled={step === 0 || pending} type="button" variant="ghost" onClick={() => setStep((current) => current - 1)}>
                Volver
              </Button>
              <div className="grid gap-2 text-right">
                {error ? <p className="max-w-md text-sm text-[var(--danger)]">{error}</p> : null}
                <Button disabled={!canContinue || pending} type="submit">
                  {step === steps.length - 1 ? (pending ? "Creando" : "Crear restaurante") : "Continuar"}
                  <ArrowRight size={18} weight="bold" />
                </Button>
              </div>
            </footer>
          </form>
        </Panel>
      </section>
    </main>
  );
}

function IdentityStep({
  form,
  setSlugTouched,
  update,
  updateName
}: {
  form: FormState;
  setSlugTouched: (value: boolean) => void;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  updateName: (value: string) => void;
}) {
  return (
    <section className="grid gap-5">
      <StepIntro
        icon={<Storefront size={24} weight="duotone" />}
        title="Datos base del local"
        body="Con estos datos creamos tu restaurante y tu cuenta de acceso al panel."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre del restaurante">
          <input className={inputClassName} value={form.restaurantName} onChange={(event) => updateName(event.target.value)} />
        </Field>
        <Field hint="Solo letras, numeros y guiones. Asi va a quedar el link de reservas." label="Nombre en la web">
          <input
            className={inputClassName}
            value={form.slug}
            onChange={(event) => {
              setSlugTouched(true);
              update("slug", slugify(event.target.value));
            }}
          />
        </Field>
        <Field label="Tu nombre">
          <input className={inputClassName} value={form.ownerName} onChange={(event) => update("ownerName", event.target.value)} />
        </Field>
        <Field label="Tu email">
          <input className={inputClassName} type="email" value={form.ownerEmail} onChange={(event) => update("ownerEmail", event.target.value)} />
        </Field>
        <Field hint="Minimo 8 caracteres." label="Password">
          <input className={inputClassName} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} />
        </Field>
        <Field label="Zona horaria">
          <input className={inputClassName} value={form.timezone} onChange={(event) => update("timezone", event.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Color acento">
          <input className={`${inputClassName} h-12 p-1`} type="color" value={form.accent} onChange={(event) => update("accent", event.target.value)} />
        </Field>
        <Field label="Foto de portada (URL)">
          <input className={inputClassName} value={form.heroImageUrl} onChange={(event) => update("heroImageUrl", event.target.value)} />
        </Field>
        <Field label="Logo (URL)">
          <input className={inputClassName} value={form.logoUrl} onChange={(event) => update("logoUrl", event.target.value)} />
        </Field>
      </div>
    </section>
  );
}

function RoomStep({
  form,
  update,
  zoneList
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  zoneList: string[];
}) {
  return (
    <section className="grid gap-5">
      <StepIntro
        icon={<ForkKnife size={24} weight="duotone" />}
        title="Salon y capacidad inicial"
        body="Elegí el tamaño del salon. Siempre podes agregar o quitar mesas desde el panel."
      />
      <Field hint="Separalas con coma. Ej: Salon principal, Patio, Terraza." label="Zonas">
        <input className={inputClassName} value={form.zoneNames} onChange={(event) => update("zoneNames", event.target.value)} />
      </Field>
      <div className="grid gap-3 md:grid-cols-3">
        {(Object.keys(tableProfiles) as TableProfile[]).map((profile) => (
          <button
            className={`rounded-[var(--radius-lg)] border p-4 text-left transition-all duration-500 ease-[var(--ease-press)] ${
              form.tableProfile === profile
                ? "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_16px_34px_color-mix(in_srgb,var(--accent)_25%,transparent)]"
                : "border-[var(--border)] bg-[var(--card-raised)] hover:-translate-y-0.5 hover:border-[var(--border-strong)]"
            }`}
            key={profile}
            onClick={() => update("tableProfile", profile)}
            type="button"
          >
            <span className="font-display text-2xl font-semibold">{tableProfiles[profile].label}</span>
            <span className="mt-2 block text-sm opacity-78">{tableProfiles[profile].description}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {zoneList.map((zone) => <Badge key={zone}>{zone}</Badge>)}
      </div>
    </section>
  );
}

function ServicesStep({
  form,
  update
}: {
  form: FormState;
  update: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <section className="grid gap-5">
      <StepIntro
        icon={<CalendarDots size={24} weight="duotone" />}
        title="Servicios y ritmo"
        body="Creamos turnos todos los dias para que el booking ya devuelva disponibilidad real. Despues podes editar dias puntuales desde configuracion."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <ServiceCard
          enabled={form.lunchEnabled}
          end={form.lunchEnd}
          label="Almuerzo"
          start={form.lunchStart}
          onEnabled={(value) => update("lunchEnabled", value)}
          onEnd={(value) => update("lunchEnd", value)}
          onStart={(value) => update("lunchStart", value)}
        />
        <ServiceCard
          enabled={form.dinnerEnabled}
          end={form.dinnerEnd}
          label="Cena"
          start={form.dinnerStart}
          onEnabled={(value) => update("dinnerEnabled", value)}
          onEnd={(value) => update("dinnerEnd", value)}
          onStart={(value) => update("dinnerStart", value)}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Cada cuanto se puede reservar">
          <select className={inputClassName} value={form.slotIntervalMin} onChange={(event) => update("slotIntervalMin", Number(event.target.value))}>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
          </select>
        </Field>
        <Field label="Cuanto dura cada turno">
          <select className={inputClassName} value={form.turnDurationMin} onChange={(event) => update("turnDurationMin", Number(event.target.value))}>
            <option value={75}>75 min</option>
            <option value={90}>90 min</option>
            <option value={120}>120 min</option>
          </select>
        </Field>
        <Field hint="Opcional. Maximo de personas por franja horaria." label="Limite de cubiertos">
          <input className={inputClassName} min={1} type="number" value={form.pacingCap} onChange={(event) => update("pacingCap", event.target.value)} />
        </Field>
      </div>
    </section>
  );
}

function PublishStep({
  currentProfile,
  form,
  zoneList
}: {
  currentProfile: { label: string; description: string; mesas: number };
  form: FormState;
  zoneList: string[];
}) {
  return (
    <section className="grid gap-5">
      <StepIntro
        icon={<PaintBrush size={24} weight="duotone" />}
        title="Revisar y publicar"
        body="Al finalizar, tu restaurante queda activo y ya podes empezar a recibir reservas."
      />
      <div className="grid gap-3">
        <ReviewRow label="Restaurante" value={form.restaurantName} />
        <ReviewRow label="Link" value={`/r/${form.slug}`} />
        <ReviewRow label="Responsable" value={`${form.ownerName} - ${form.ownerEmail}`} />
        <ReviewRow label="Salon" value={`${currentProfile.label}, ${currentProfile.mesas} mesas, ${zoneList.length} zonas`} />
        <ReviewRow label="Servicios" value={[form.lunchEnabled ? "Almuerzo" : null, form.dinnerEnabled ? "Cena" : null].filter(Boolean).join(" + ")} />
      </div>
    </section>
  );
}

function OnboardingSuccess({ result }: { result: OnboardingResponse }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
  }

  return (
    <main id="content" className="min-h-screen bg-[var(--background)] px-4 py-4 sm:px-6 lg:py-6">
      <section className="surface-shell mx-auto max-w-6xl">
        <div className="surface-core grid gap-6 overflow-hidden p-5 sm:p-8">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <Badge className="gap-1 text-[var(--success)]">
                <CheckCircle size={15} weight="fill" />
                Restaurante creado
              </Badge>
              <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-none">{result.restaurant.name} ya puede recibir reservas.</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                Creamos {result.counts.zones} zonas, {result.counts.mesas} mesas, {result.counts.services} servicios y {result.counts.shifts} turnos. Ya podes ingresar al panel con tus datos.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]" href={result.links.adminUrl}>
                Abrir panel
              </Link>
              <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] px-4 text-sm font-semibold" href={result.links.bookingUrl}>
                Ver pagina de reservas
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SnippetCard copied={copied === "iframe"} label="Codigo para tu web" value={result.links.iframe} onCopy={() => copy("iframe", result.links.iframe)} />
            <SnippetCard copied={copied === "script"} label="Codigo avanzado para tu web" value={result.links.script} onCopy={() => copy("script", result.links.script)} />
          </div>

          <div className="grid gap-3 rounded-[var(--radius-lg)] bg-[var(--muted)] p-4 sm:grid-cols-3">
            <SummaryItem icon={<LinkSimple size={17} weight="duotone" />} label="Booking" value={result.links.bookingUrl} />
            <SummaryItem icon={<StackPlus size={17} weight="duotone" />} label="Insertar en web" value={result.links.embedUrl} />
            <SummaryItem icon={<UsersThree size={17} weight="duotone" />} label="Administrador" value={result.staff.email} />
          </div>
        </div>
      </section>
    </main>
  );
}

function ServiceCard({
  enabled,
  end,
  label,
  start,
  onEnabled,
  onEnd,
  onStart
}: {
  enabled: boolean;
  end: string;
  label: string;
  start: string;
  onEnabled: (value: boolean) => void;
  onEnd: (value: string) => void;
  onStart: (value: string) => void;
}) {
  return (
    <div className={`grid gap-4 rounded-[var(--radius-lg)] border p-4 ${enabled ? "border-[var(--border-strong)] bg-[var(--card-raised)]" : "border-[var(--border)] bg-[var(--muted)] opacity-75"}`}>
      <label className="flex items-center justify-between gap-3">
        <span className="font-display text-2xl font-semibold">{label}</span>
        <input checked={enabled} type="checkbox" onChange={(event) => onEnabled(event.target.checked)} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Inicio"><input className={inputClassName} disabled={!enabled} type="time" value={start} onChange={(event) => onStart(event.target.value)} /></Field>
        <Field label="Fin"><input className={inputClassName} disabled={!enabled} type="time" value={end} onChange={(event) => onEnd(event.target.value)} /></Field>
      </div>
    </div>
  );
}

function StepIntro({ body, icon, title }: { body: string; icon: React.ReactNode; title: string }) {
  return (
    <div className="grid gap-3">
      <div className="grid h-12 w-12 place-items-center rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--accent)]">{icon}</div>
      <div>
        <h3 className="text-4xl font-semibold leading-tight">{title}</h3>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{body}</p>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-2 rounded-[var(--radius-sm)] bg-[var(--card-raised)] p-3">
      <span className="text-[var(--accent)]">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-[var(--muted-foreground)]">{label}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 py-3 text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right font-semibold">{value || "-"}</span>
    </div>
  );
}

function SnippetCard({ copied, label, onCopy, value }: { copied: boolean; label: string; onCopy: () => void; value: string }) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{label}</h2>
        <Button size="sm" type="button" variant="secondary" onClick={onCopy}>
          <ClipboardText size={16} weight="bold" />
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre className="max-h-52 overflow-auto rounded-[var(--radius-sm)] bg-[var(--muted)] p-3 text-xs leading-6">{value}</pre>
    </div>
  );
}
