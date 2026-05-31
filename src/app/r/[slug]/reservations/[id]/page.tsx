import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ReservationManager } from "@/components/booking/reservation-manager";
import { getPublicRestaurant } from "@/features/repositories";
import { getLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ReservationManagementPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { slug, id } = await params;
  const { locale: localeParam } = await searchParams;
  const locale = getLocale(localeParam);
  const restaurant = await getPublicRestaurant(slug);
  if (!restaurant) notFound();

  const branding = (restaurant.settings.branding as Record<string, unknown> | undefined) ?? {};
  const accent = typeof branding.accent === "string" ? branding.accent : "#0f766e";

  return (
    <main
      id="content"
      className="booking-brand grid min-h-[100dvh] place-items-center px-4 py-6 sm:px-6"
      style={{ "--restaurant-accent": accent } as CSSProperties}
    >
      <ReservationManager id={id} locale={locale} slug={slug} />
    </main>
  );
}
