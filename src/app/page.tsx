import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-10">
      <section className="mx-auto grid max-w-3xl gap-6">
        <div>
          <p className="font-mono text-sm text-[var(--muted-foreground)]">MVP</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-normal">Sistema de reservas</h1>
          <p className="mt-3 max-w-xl text-[var(--muted-foreground)]">
            Reserva web, panel de restaurante, disponibilidad real y recordatorios por email.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-[var(--accent)] px-4 text-sm font-medium text-white"
            href="/r/demo-bistro"
          >
            Abrir booking demo
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-[var(--border)] bg-white px-4 text-sm font-medium"
            href="/admin"
          >
            Abrir panel
          </Link>
        </div>
      </section>
    </main>
  );
}
