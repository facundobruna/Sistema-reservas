import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";

export function LegalShell({
  eyebrow,
  title,
  intro,
  children
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main id="content" className="min-h-screen px-[var(--space-page)] py-6">
      <section className="mx-auto grid max-w-5xl gap-8 py-8 md:py-14">
        <div className="reveal-in grid gap-5">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]" href="/">
            <ArrowLeft size={16} weight="bold" />
            Mesa Clara
          </Link>
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{eyebrow}</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold leading-none md:text-7xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[var(--muted-foreground)] md:text-lg">{intro}</p>
          </div>
        </div>
        <div className="reveal-in reveal-delay-1 grid gap-4">{children}</div>
      </section>
    </main>
  );
}

export function LegalSection({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--card-raised)_86%,transparent)] p-5 sm:p-7">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3 text-sm leading-7 text-[var(--muted-foreground)]">{children}</div>
    </section>
  );
}
