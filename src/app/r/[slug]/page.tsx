import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getPublicRestaurant } from "@/features/repositories";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function RestaurantBookingPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { slug } = await params;
  const { locale: localeParam } = await searchParams;
  const locale = getLocale(localeParam);
  const restaurant = await getPublicRestaurant(slug);
  if (!restaurant) notFound();

  const branding = (restaurant.settings.branding as Record<string, unknown> | undefined) ?? {};
  const accent =
    typeof branding.accent === "string"
      ? branding.accent
      : "#0f766e";
  const heroImage =
    typeof branding.heroImageUrl === "string"
      ? branding.heroImageUrl
      : typeof branding.photoUrl === "string"
        ? branding.photoUrl
        : null;
  const logoUrl = typeof branding.logoUrl === "string" ? branding.logoUrl : null;

  return (
    <main
      id="content"
      className="booking-brand min-h-[100dvh] px-4 py-4 sm:px-6 lg:py-6"
      style={{ "--restaurant-accent": accent } as CSSProperties}
    >
      <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(320px,0.88fr)_minmax(0,1.12fr)]">
        <aside className="reveal-in surface-shell lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <div className="surface-core grid h-full overflow-hidden">
            <div
              className="relative min-h-64 overflow-hidden rounded-[calc(var(--radius-xl)-0.375rem)] bg-[#2d2018] text-[#fff8ed] lg:min-h-0"
              style={
                heroImage
                  ? {
                      backgroundImage: `linear-gradient(180deg, rgba(23,18,15,0.12), rgba(23,18,15,0.78)), url(${heroImage})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center"
                    }
                  : undefined
              }
            >
              {!heroImage ? (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(230,184,120,0.22),transparent_24rem),linear-gradient(135deg,#241914,#7a3b24)]" />
              ) : null}
              <div className="relative grid h-full min-h-64 content-between gap-8 p-5 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={`${restaurant.name} logo`} className="max-h-12 max-w-32 rounded-[var(--radius-xs)] object-contain" src={logoUrl} />
                  ) : (
                    <div className="grid h-12 w-12 place-items-center rounded-[var(--radius-sm)] bg-white/12 font-display text-2xl">
                      {restaurant.name.slice(0, 1)}
                    </div>
                  )}
                  <span className="rounded-[var(--radius-xs)] bg-white/12 px-3 py-1 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-[#e7ccb9]">
                    {locale === "en" ? "Booking" : "Reservas"}
                  </span>
                </div>
                <div>
                  <h1 className="max-w-xl text-5xl font-semibold leading-none md:text-6xl">{restaurant.name}</h1>
                  <p className="mt-5 max-w-md text-sm leading-7 text-[#ead8ca]">
                    {locale === "en"
                      ? "Choose a table time with live availability. The restaurant confirms against its real dining-room inventory."
                      : "Elegi horario con disponibilidad real. El restaurante confirma contra el inventario vivo del salon."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {restaurant.zones.slice(0, 4).map((zone) => (
                    <div className="rounded-[var(--radius-sm)] bg-white/10 px-3 py-2 text-[#fff8ed]" key={zone.id}>
                      {zone.name}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>
        <BookingWizard locale={locale} restaurant={restaurant} />
      </section>
    </main>
  );
}
