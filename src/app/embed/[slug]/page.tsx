import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicRestaurant } from "@/features/repositories";

export const dynamic = "force-dynamic";

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getPublicRestaurant(slug);
  if (!restaurant) notFound();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const iframe = `<iframe src="${appUrl}/r/${restaurant.slug}?embed=1" style="width:100%;height:720px;border:0;border-radius:8px" loading="lazy"></iframe>`;
  const script = `<script async src="${appUrl}/embed/${restaurant.slug}/script"></script>`;

  return (
    <main id="content" className="min-h-screen px-4 py-6 sm:px-6">
      <section className="surface-shell mx-auto max-w-5xl">
        <div className="surface-core grid gap-6 p-5 sm:p-8">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
            <div>
              <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Distribucion web</p>
              <h1 className="mt-2 max-w-3xl text-5xl font-semibold leading-none">{restaurant.name}</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">
                Pega cualquiera de estos snippets en el sitio del restaurante. El boton o embed llevan al mismo flujo rapido, sin cuenta ni app.
              </p>
            </div>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 text-sm font-semibold text-[var(--accent-foreground)]"
              href={`/r/${restaurant.slug}`}
            >
              Ver booking
            </Link>
          </div>
          <EmbedSnippet label="Iframe" value={iframe} />
          <EmbedSnippet label="Script" value={script} />
        </div>
      </section>
    </main>
  );
}

function EmbedSnippet({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4">
      <h2 className="text-2xl font-semibold">{label}</h2>
      <pre className="overflow-x-auto rounded-[var(--radius-sm)] bg-[var(--muted)] p-3 text-sm leading-6">{value}</pre>
    </div>
  );
}
