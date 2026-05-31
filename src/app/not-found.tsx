import { ArrowLeft, ForkKnife } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export default function NotFound() {
  return (
    <main id="content" className="grid min-h-[100dvh] place-items-center px-[var(--space-page)] py-12">
      <section className="surface-shell max-w-2xl">
        <div className="surface-core grid gap-6 p-8 text-center md:p-12">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[var(--radius-md)] bg-[var(--muted)] text-[var(--accent)]">
            <ForkKnife size={34} weight="duotone" />
          </div>
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">404</p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight">Esta mesa no esta disponible.</h1>
            <p className="mt-4 text-sm leading-7 text-[var(--muted-foreground)]">
              La pagina puede haberse movido o el link de reserva ya no existe.
            </p>
          </div>
          <Link
            className="mx-auto inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
            href="/"
          >
            <ArrowLeft size={17} weight="bold" />
            Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
