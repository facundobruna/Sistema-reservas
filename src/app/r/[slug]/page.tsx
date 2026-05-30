import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getPublicRestaurant } from "@/features/repositories";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const dynamic = "force-dynamic";

export default async function RestaurantBookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = await getPublicRestaurant(slug);
  if (!restaurant) notFound();

  const accent =
    typeof (restaurant.settings.branding as { accent?: unknown } | undefined)?.accent === "string"
      ? ((restaurant.settings.branding as { accent: string }).accent)
      : "#0f766e";

  return (
    <main
      className="booking-brand min-h-screen px-4 py-4 sm:px-6"
      style={{ "--restaurant-accent": accent } as CSSProperties}
    >
      <section className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="grid content-start gap-4 py-4">
          <p className="font-mono text-sm text-[var(--muted-foreground)]">Reservas</p>
          <h1 className="text-4xl font-semibold tracking-normal">{restaurant.name}</h1>
          <p className="max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
            Elegi comensales, fecha y horario. El sistema valida disponibilidad real antes de confirmar.
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {restaurant.zones.map((zone) => (
              <div className="rounded-md border border-[var(--border)] bg-white px-3 py-2" key={zone.id}>
                {zone.name}
              </div>
            ))}
          </div>
        </aside>
        <BookingWizard restaurant={restaurant} />
      </section>
    </main>
  );
}
