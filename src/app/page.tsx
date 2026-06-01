import Link from "next/link";
import { ArrowRight, CalendarDots, ChartLineUp, ForkKnife, ShieldCheck } from "@phosphor-icons/react/dist/ssr";

export default function HomePage() {
  return (
    <main id="content" className="min-h-[100dvh] px-[var(--space-page)] py-6">
      <section className="mx-auto grid max-w-7xl gap-10 py-10 md:grid-cols-[1.05fr_0.95fr] md:py-20">
        <div className="reveal-in grid content-center gap-8">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Mesa Clara / reservas B2B</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal md:text-7xl">
              Reservas con la calma de un buen salon.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] md:text-lg">
              Un sistema para restaurantes que necesitan confirmar mesas, cuidar el ritmo de cocina y operar la agenda sin perder hospitalidad.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              className="group inline-flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 text-sm font-semibold text-[var(--accent-foreground)] shadow-[0_16px_34px_color-mix(in_srgb,var(--accent)_28%,transparent)] transition-all duration-500 ease-[var(--ease-press)] hover:-translate-y-0.5"
              href="/onboarding"
            >
              Crear restaurante
              <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-xs)] bg-white/18 transition-transform duration-500 ease-[var(--ease-press)] group-hover:translate-x-0.5">
                <ArrowRight size={15} weight="bold" />
              </span>
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-5 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-press)] hover:-translate-y-0.5"
              href="/r/demo-bistro"
            >
              Booking demo
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-5 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-press)] hover:-translate-y-0.5"
              href="/admin"
            >
              Abrir panel
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] px-3 text-sm font-semibold text-[var(--muted-foreground)] transition-colors duration-500 hover:text-[var(--foreground)]"
              href="/style-guide"
            >
              Ver sistema visual
            </Link>
          </div>
        </div>

        <div className="reveal-in reveal-delay-2 surface-shell">
          <div className="surface-core grid gap-4 p-4 md:p-6">
            <div className="grid min-h-72 content-between rounded-[var(--radius-lg)] bg-[linear-gradient(135deg,#2f2119,#7f3d25)] p-5 text-[#fff8ed]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase text-[#e8cbb6]">Hoy / Cena</p>
                  <h2 className="mt-3 max-w-sm text-4xl font-semibold leading-none">54 cubiertos confirmados</h2>
                </div>
                <ForkKnife size={34} weight="duotone" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["19:30", "20:00", "21:30"].map((time, index) => (
                  <div className="rounded-[var(--radius-sm)] bg-white/10 p-3" key={time}>
                    <p className="font-mono text-sm">{time}</p>
                    <p className="mt-1 text-xs text-[#e8cbb6]">{[12, 18, 24][index]} pax</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Anti doble-booking", ShieldCheck],
                ["Agenda viva", CalendarDots],
                ["Datos accionables", ChartLineUp]
              ].map(([label, Icon]) => (
                <div className="rounded-[var(--radius-md)] bg-[var(--muted)] p-4" key={String(label)}>
                  <Icon size={24} weight="duotone" className="text-[var(--accent)]" />
                  <p className="mt-3 text-sm font-semibold">{String(label)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl flex-wrap gap-4 border-t border-[var(--border)] py-6 text-sm text-[var(--muted-foreground)]">
        <Link className="hover:text-[var(--foreground)]" href="/legal/terms">
          Terminos
        </Link>
        <Link className="hover:text-[var(--foreground)]" href="/legal/privacy">
          Privacidad
        </Link>
        <Link className="hover:text-[var(--foreground)]" href="/legal/data">
          Datos del comensal
        </Link>
      </footer>
    </main>
  );
}
