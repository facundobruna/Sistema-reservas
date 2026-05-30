import { notFound } from "next/navigation";
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
    <main className="min-h-screen px-5 py-10">
      <section className="mx-auto grid max-w-3xl gap-5">
        <div>
          <p className="font-mono text-sm text-[var(--muted-foreground)]">Embed</p>
          <h1 className="mt-2 text-3xl font-semibold">{restaurant.name}</h1>
        </div>
        <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
          <h2 className="font-semibold">Iframe</h2>
          <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-3 text-sm">{iframe}</pre>
        </div>
        <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-white p-4">
          <h2 className="font-semibold">Script</h2>
          <pre className="overflow-x-auto rounded-md bg-[var(--muted)] p-3 text-sm">{script}</pre>
        </div>
      </section>
    </main>
  );
}
