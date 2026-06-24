import Link from "next/link";
import {
  ArrowRight,
  CalendarDots,
  CheckCircle,
  ForkKnife,
  InstagramLogo,
  LinkSimple,
  QrCode,
  ShieldCheck,
  WhatsappLogo
} from "@phosphor-icons/react/dist/ssr";

export default function HomePage() {
  return (
    <main id="content" className="min-h-[100dvh] px-[var(--space-page)] py-6">
      <section className="mx-auto grid max-w-7xl gap-10 py-8 md:grid-cols-[1.02fr_0.98fr] md:py-16">
        <div className="reveal-in grid content-center gap-8">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Mesa Clara / para restaurantes</p>
            <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal md:text-7xl">
              La reserva mas rapida y sin friccion que existe.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] md:text-lg">
              Tus clientes ya estan en Instagram, WhatsApp o tu pagina web. Mesa Clara les permite reservar en segundos, sin crear cuenta, sin poner el DNI ni bajar ninguna app.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {["Cero login", "Cero DNI", "Cero sena", "Cero app"].map((item) => (
              <span
                className="inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 text-sm font-semibold shadow-[var(--shadow-soft)]"
                key={item}
              >
                <CheckCircle size={16} weight="fill" className="text-[var(--success)]" />
                {item}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="group inline-flex min-h-12 items-center gap-3 rounded-[var(--radius-sm)] bg-[var(--foreground)] px-5 text-sm font-medium text-[var(--background)] shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-press)] hover:opacity-90 active:scale-[0.985]"
              href="/onboarding"
            >
              Crear flujo de reservas
              <span className="grid h-7 w-7 place-items-center rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--background)_22%,transparent)] transition-transform duration-200 ease-[var(--ease-press)] group-hover:translate-x-0.5">
                <ArrowRight size={15} weight="bold" />
              </span>
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-5 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-press)] hover:-translate-y-0.5"
              href="/r/demo-bistro"
            >
              Ver ejemplo
            </Link>
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-5 text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-soft)] transition-all duration-500 ease-[var(--ease-press)] hover:-translate-y-0.5"
              href="/admin"
            >
              Abrir panel
            </Link>
          </div>
        </div>

        <div className="reveal-in reveal-delay-2 surface-shell">
          <div className="surface-core grid gap-4 p-4 md:p-6">
            <div className="grid min-h-96 content-between rounded-[var(--radius-lg)] bg-[#17251f] p-5 text-[#f5fff8]">
              <div className="grid gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase text-[#a7d8bf]">Demo Bistro</p>
                    <h2 className="mt-2 max-w-sm text-4xl font-semibold leading-none">Reservar mesa</h2>
                  </div>
                  <ForkKnife size={34} weight="duotone" />
                </div>
                <div className="grid gap-2">
                  {[
                    ["1", "Comensales", "4 personas"],
                    ["2", "Horario", "Hoy 21:00"],
                    ["3", "Contacto", "Nombre + telefono"]
                  ].map(([number, label, value]) => (
                    <div className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-[var(--radius-sm)] bg-white/10 p-3" key={label}>
                      <span className="grid h-9 w-9 place-items-center rounded-[var(--radius-xs)] bg-[#f5fff8] font-mono text-sm font-semibold text-[#17251f]">
                        {number}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{label}</span>
                        <span className="block text-xs text-[#a7d8bf]">{value}</span>
                      </span>
                      <CheckCircle size={19} weight="fill" className="text-[#7be0a4]" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-[#f5fff8] p-4 text-[#17251f]">
                <p className="font-mono text-xs uppercase text-[#466554]">Confirmacion</p>
                <p className="mt-2 text-2xl font-semibold leading-tight">Reserva lista. Sin cuenta creada.</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Siempre actualizado", CalendarDots],
                ["Sin reservas duplicadas", ShieldCheck],
                ["Panel para tu equipo", ForkKnife]
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

      <section className="mx-auto grid max-w-7xl gap-5 border-t border-[var(--border)] py-8 md:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Distribucion</p>
          <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">Tus clientes ya estan en las redes. Que reserven desde ahi.</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["Instagram", "Pones el link en tu perfil y tus seguidores reservan directo desde ahi.", InstagramLogo],
            ["Pagina web", "Un boton de reserva que podés agregar facilmente a tu sitio web.", LinkSimple],
            ["Codigo QR", "Lo imprimis y lo pones en la mesa o en la entrada del local.", QrCode],
            ["WhatsApp", "Tus clientes te escriben y vos les mandas el link para reservar.", WhatsappLogo]
          ].map(([title, body, Icon]) => (
            <article className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-[var(--shadow-soft)]" key={String(title)}>
              <Icon size={24} weight="duotone" className="text-[var(--accent)]" />
              <h3 className="mt-3 text-lg font-semibold">{String(title)}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{String(body)}</p>
            </article>
          ))}
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
