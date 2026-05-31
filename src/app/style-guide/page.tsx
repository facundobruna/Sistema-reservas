import {
  CalendarDots,
  CheckCircle,
  Clock,
  ForkKnife,
  GearSix,
  UsersThree,
  WarningCircle
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Panel, Skeleton, inputClassName } from "@/components/ui/field";

const swatches = [
  ["Background", "--background"],
  ["Foreground", "--foreground"],
  ["Card", "--card"],
  ["Muted", "--muted"],
  ["Accent", "--accent"],
  ["Danger", "--danger"],
  ["Success", "--success"]
];

const spacing = ["0.375rem", "0.625rem", "0.875rem", "1.25rem", "1.75rem", "2.75rem"];

export default function StyleGuidePage() {
  return (
    <main id="content" className="min-h-[100dvh] px-[var(--space-page)] py-8">
      <section className="mx-auto grid max-w-7xl gap-10">
        <header className="reveal-in grid gap-5 border-b border-[var(--border)] pb-10 md:grid-cols-[0.9fr_1.1fr] md:items-end">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Mesa Clara / style-guide</p>
            <h1 className="mt-4 text-5xl font-semibold leading-none md:text-7xl">Hospitalidad editorial.</h1>
          </div>
          <p className="max-w-2xl text-base leading-8 text-[var(--muted-foreground)]">
            Sistema visual para producto SaaS y booking por restaurante: calido, preciso, con superficies materiales,
            tipografia de caracter y estados de interfaz resueltos.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="01" title="Tokens" text="La paleta usa neutrales calidos, acento profundo y roles semanticos para estado." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {swatches.map(([label, token], index) => (
              <div className="reveal-in surface-shell" style={{ animationDelay: `${index * 45}ms` }} key={token}>
                <div className="surface-core p-4">
                  <div className="h-24 rounded-[var(--radius-md)] border border-[var(--border)]" style={{ background: `var(${token})` }} />
                  <p className="mt-4 text-sm font-semibold">{label}</p>
                  <p className="font-mono text-xs text-[var(--muted-foreground)]">{token}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="02" title="Tipografia" text="Fraunces toma los momentos editoriales; Manrope sostiene UI y lectura operativa." />
          <Panel>
            <div className="grid gap-8 p-6">
              <div>
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Display / Fraunces</p>
                <h2 className="mt-3 max-w-3xl text-5xl font-semibold leading-none">Una mesa libre no es solo inventario.</h2>
              </div>
              <div>
                <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Body / Manrope</p>
                <p className="mt-3 max-w-2xl text-base leading-8 text-[var(--muted-foreground)]">
                  La interfaz debe ayudar al equipo a leer rapidamente el estado del salon, decidir sin friccion y
                  mantener un trato cuidado con cada comensal.
                </p>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="03" title="Componentes" text="Botones, campos y estados comparten radios, motion y foco accesible." />
          <Panel>
            <div className="grid gap-8 p-6">
              <div className="flex flex-wrap gap-3">
                <Button><CheckCircle size={18} weight="bold" /> Confirmar</Button>
                <Button variant="secondary"><CalendarDots size={18} weight="duotone" /> Reagendar</Button>
                <Button variant="quiet"><Clock size={18} weight="duotone" /> Pausar turno</Button>
                <Button variant="danger"><WarningCircle size={18} weight="bold" /> Cancelar</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Restaurante" hint="Visible en booking, emails y embed.">
                  <input className={inputClassName} defaultValue="Demo Bistro" />
                </Field>
                <Field label="Zona">
                  <select className={inputClassName} defaultValue="salon">
                    <option value="salon">Salon principal</option>
                    <option value="patio">Patio</option>
                  </select>
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge>confirmed</Badge>
                <Badge>54 cubiertos</Badge>
                <Badge>pacing protegido</Badge>
              </div>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="04" title="Espaciado y radios" text="La escala evita separaciones uniformes y mantiene ritmo entre panel, campo y dato operativo." />
          <Panel>
            <div className="grid gap-5 p-6">
              {spacing.map((value, index) => (
                <div className="grid grid-cols-[5rem_1fr] items-center gap-4" key={value}>
                  <span className="font-mono text-xs text-[var(--muted-foreground)]">{value}</span>
                  <span className="block h-4 rounded-[var(--radius-xs)] bg-[var(--accent)]" style={{ width: value }} />
                  <span className="sr-only">Escala {index + 1}</span>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="05" title="Estados" text="Loading, vacio y error tienen estructura propia; no se dejan como texto gris aislado." />
          <div className="grid gap-4">
            <Panel>
              <div className="grid gap-3 p-6">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-11 w-48" />
              </div>
            </Panel>
            <EmptyState
              title="Todavia no hay reservas para este turno"
              description="Cuando entre la primera reserva, va a aparecer aca con cliente, mesa sugerida y estado operativo."
              action={<Button variant="secondary"><ForkKnife size={18} weight="duotone" /> Crear reserva manual</Button>}
            />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <GuideTitle eyebrow="06" title="Iconografia y motion" text="Phosphor es el set unico. Las animaciones usan transform y opacity, con reduced motion respetado." />
          <Panel>
            <div className="grid gap-5 p-6 sm:grid-cols-4">
              {[ForkKnife, UsersThree, GearSix, CalendarDots].map((Icon, index) => (
                <div className="reveal-in grid place-items-center rounded-[var(--radius-md)] bg-[var(--muted)] p-8 text-[var(--accent)]" style={{ animationDelay: `${index * 90}ms` }} key={index}>
                  <Icon size={38} weight="duotone" />
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-8 text-sm text-[var(--muted-foreground)]">
          <span>Tokens: color, tipografia, spacing, radios, sombras y motion.</span>
          <Link className="font-semibold text-[var(--foreground)]" href="/">
            Volver al producto
          </Link>
        </footer>
      </section>
    </main>
  );
}

function GuideTitle({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <div className="grid content-start gap-3">
      <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{eyebrow}</p>
      <h2 className="text-3xl font-semibold leading-tight md:text-4xl">{title}</h2>
      <p className="max-w-md text-sm leading-7 text-[var(--muted-foreground)]">{text}</p>
    </div>
  );
}
