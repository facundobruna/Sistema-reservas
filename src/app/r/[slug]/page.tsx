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
  if (restaurant.suspendedAt) {
    return (
      <main id="content" className="grid min-h-[100dvh] place-items-center px-5 py-10">
        <section className="w-full max-w-md rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted-foreground)]">{restaurant.name}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
            {locale === "en" ? "Booking is temporarily unavailable" : "Las reservas estan en pausa"}
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-[var(--muted-foreground)]">
            {locale === "en"
              ? "The restaurant is not accepting online reservations right now. Please contact the venue directly."
              : "El restaurante no esta tomando reservas online en este momento. Contacta al local directamente."}
          </p>
        </section>
      </main>
    );
  }

  const branding = (restaurant.settings.branding as Record<string, unknown> | undefined) ?? {};
  const accent = typeof branding.accent === "string" ? branding.accent : "#e85513";
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
      className="booking-brand relative min-h-[100dvh] overflow-hidden px-5 py-10 sm:py-14"
      style={{ "--restaurant-accent": accent } as CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(72%_60%_at_50%_-8%,color-mix(in_srgb,var(--accent)_14%,transparent),transparent_72%)]"
      />
      <div className="relative mx-auto w-full max-w-xl">
        <header className="reveal-in">
          {heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              aria-hidden
              className="mb-6 h-36 w-full rounded-[var(--radius-lg)] object-cover sm:h-44"
              src={heroImage}
            />
          ) : null}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt={`${restaurant.name} logo`} className="h-11 w-11 rounded-[var(--radius-md)] border border-[var(--border)] object-contain" src={logoUrl} />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] font-display text-lg font-semibold text-[var(--accent)]">
                {restaurant.name.slice(0, 1)}
              </div>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
              {locale === "en" ? "No login required" : "Sin cuenta obligatoria"}
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{restaurant.name}</h1>
          <p className="mt-3 max-w-md text-sm leading-7 text-[var(--muted-foreground)] sm:text-base">
            {locale === "en"
              ? "Book in a few taps. No account, ID, deposit, or app download."
              : "Reserva en pocos toques. Sin cuenta, DNI, sena ni app que bajar."}
          </p>
        </header>

        <div className="mt-8">
          <BookingWizard locale={locale} restaurant={restaurant} />
        </div>
      </div>
    </main>
  );
}
