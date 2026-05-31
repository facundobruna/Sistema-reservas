"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDots, CheckCircle, Clock, ForkKnife, MapPin, NotePencil, Prohibit, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Panel, Skeleton, inputClassName } from "@/components/ui/field";
import type { Locale } from "@/lib/i18n";

type ReservationDetails = {
  id: string;
  status: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  special_requests: string | null;
  restaurant_name: string;
  slug: string;
  timezone: string;
  service_name: string | null;
  zone_name: string | null;
};

const copy = {
  es: {
    kicker: "Gestion de reserva",
    title: "Ajusta los detalles sin llamar al local.",
    body: "Podes editar pedidos especiales, cancelar la reserva o sumar el evento a tu calendario.",
    loading: "Buscando tu reserva",
    notFound: "No pudimos abrir esta reserva",
    notFoundBody: "Usa el link de confirmacion o abri esta pagina desde el mismo navegador donde reservaste.",
    guests: "Comensales",
    date: "Fecha",
    time: "Horario",
    area: "Zona",
    service: "Servicio",
    status: "Estado",
    requests: "Pedidos especiales",
    save: "Guardar cambios",
    saving: "Guardando",
    saved: "Cambios guardados",
    cancel: "Cancelar reserva",
    cancelling: "Cancelando",
    cancelled: "Reserva cancelada",
    downloadIcs: "Descargar .ics",
    googleCalendar: "Google Calendar",
    finalStatus: "Esta reserva ya no admite cambios.",
    error: "No se pudo completar la accion"
  },
  en: {
    kicker: "Reservation management",
    title: "Adjust the details without calling the venue.",
    body: "You can edit special requests, cancel the reservation, or add the event to your calendar.",
    loading: "Loading your reservation",
    notFound: "We could not open this reservation",
    notFoundBody: "Use the confirmation link or open this page from the same browser where you booked.",
    guests: "Guests",
    date: "Date",
    time: "Time",
    area: "Area",
    service: "Service",
    status: "Status",
    requests: "Special requests",
    save: "Save changes",
    saving: "Saving",
    saved: "Changes saved",
    cancel: "Cancel reservation",
    cancelling: "Cancelling",
    cancelled: "Reservation cancelled",
    downloadIcs: "Download .ics",
    googleCalendar: "Google Calendar",
    finalStatus: "This reservation no longer accepts changes.",
    error: "The action could not be completed"
  }
} as const;

function authHeaders(token: string | null) {
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

function googleCalendarUrl(reservation?: ReservationDetails) {
  if (!reservation) return "#";
  const start = DateTime.fromISO(reservation.starts_at).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const end = DateTime.fromISO(reservation.ends_at).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Reserva en ${reservation.restaurant_name}`,
    dates: `${start}/${end}`,
    details: `Reserva para ${reservation.party_size} personas.`,
    location: reservation.restaurant_name
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function ReservationManager({ id, locale, slug }: { id: string; locale: Locale; slug: string }) {
  const c = copy[locale];
  const search = useSearchParams();
  const token = search.get("token");
  const [specialRequests, setSpecialRequests] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const reservation = useQuery({
    queryKey: ["diner-reservation", slug, id, token],
    queryFn: async () => {
      const response = await fetch(`/api/v1/r/${slug}/reservations/${id}`, {
        headers: authHeaders(token)
      });
      if (!response.ok) throw new Error(String(response.status));
      return (await response.json()) as ReservationDetails;
    }
  });

  const patchReservation = useMutation({
    mutationFn: async (body: { specialRequests?: string | null; status?: "cancelled" }) => {
      const response = await fetch(`/api/v1/r/${slug}/reservations/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          ...authHeaders(token)
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(payload.message ?? c.error);
      }
      return response.json();
    },
    onSuccess: async () => {
      setSaved(true);
      await reservation.refetch();
      setSpecialRequests(null);
    }
  });

  const calendarUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (token) params.set("token", token);
    const query = params.toString();
    return `/api/v1/r/${slug}/reservations/${id}/calendar${query ? `?${query}` : ""}`;
  }, [id, slug, token]);

  const finalStatus = reservation.data ? ["cancelled", "completed", "no_show"].includes(reservation.data.status) : false;
  const specialRequestsValue = specialRequests ?? reservation.data?.special_requests ?? "";

  return (
    <Panel className="mx-auto w-full max-w-4xl reveal-in">
      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_18rem]">
        <section className="grid content-start gap-6">
          <div className="grid gap-3">
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{c.kicker}</p>
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">{c.title}</h1>
            <p className="max-w-2xl text-sm leading-7 text-[var(--muted-foreground)]">{c.body}</p>
          </div>

          {reservation.isLoading ? (
            <div className="grid gap-3">
              <Skeleton className="h-20" />
              <Skeleton className="h-36" />
            </div>
          ) : null}

          {reservation.isError ? (
            <EmptyState
              title={c.notFound}
              description={c.notFoundBody}
              action={
                <Badge>
                  <WarningCircle className="mr-2" size={15} weight="duotone" />
                  {c.status}
                </Badge>
              }
            />
          ) : null}

          {reservation.data ? (
            <div className="grid gap-4">
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_srgb,var(--muted)_36%,transparent)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">{reservation.data.restaurant_name}</p>
                    <h2 className="mt-1 text-2xl font-semibold">{DateTime.fromISO(reservation.data.starts_at).setLocale(locale).toFormat("DDDD")}</h2>
                  </div>
                  <Badge>{reservation.data.status}</Badge>
                </div>
              </div>

              <Field label={c.requests} hint={finalStatus ? c.finalStatus : undefined}>
                <textarea
                  className={`${inputClassName} min-h-36 py-3`}
                  disabled={finalStatus || patchReservation.isPending}
                  value={specialRequestsValue}
                  onChange={(event) => {
                    setSaved(false);
                    setSpecialRequests(event.target.value);
                  }}
                />
              </Field>

              {patchReservation.error ? (
                <div className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card-raised))] p-4 text-sm text-[var(--danger)]">
                  {patchReservation.error.message}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={finalStatus || patchReservation.isPending}
                  onClick={() => patchReservation.mutate({ specialRequests: specialRequestsValue.trim() || null })}
                >
                  <CheckCircle size={18} weight="bold" />
                  {patchReservation.isPending ? c.saving : saved ? c.saved : c.save}
                </Button>
                <Button
                  disabled={finalStatus || patchReservation.isPending}
                  variant="danger"
                  onClick={() => patchReservation.mutate({ status: "cancelled" })}
                >
                  <Prohibit size={18} weight="bold" />
                  {patchReservation.isPending ? c.cancelling : reservation.data.status === "cancelled" ? c.cancelled : c.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </section>

        <aside className="grid content-start gap-3 rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--muted)_46%,transparent)] p-4">
          {reservation.data ? (
            <>
              <SummaryItem icon={<UsersThree size={17} weight="duotone" />} label={c.guests} value={String(reservation.data.party_size)} />
              <SummaryItem icon={<CalendarDots size={17} weight="duotone" />} label={c.date} value={DateTime.fromISO(reservation.data.starts_at).setLocale(locale).toFormat("dd LLL")} />
              <SummaryItem icon={<Clock size={17} weight="duotone" />} label={c.time} value={DateTime.fromISO(reservation.data.starts_at).setZone(reservation.data.timezone).toFormat("HH:mm")} />
              <SummaryItem icon={<MapPin size={17} weight="duotone" />} label={c.area} value={reservation.data.zone_name ?? "-"} />
              <SummaryItem icon={<ForkKnife size={17} weight="duotone" />} label={c.service} value={reservation.data.service_name ?? "-"} />
              <a className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-4 text-sm font-semibold" href={calendarUrl}>
                <NotePencil size={18} weight="duotone" />
                <span className="ml-2">{c.downloadIcs}</span>
              </a>
              <a className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-4 text-sm font-semibold" href={googleCalendarUrl(reservation.data)} rel="noreferrer" target="_blank">
                <CalendarDots size={18} weight="duotone" />
                <span className="ml-2">{c.googleCalendar}</span>
              </a>
            </>
          ) : (
            <Skeleton className="h-48" />
          )}
        </aside>
      </div>
    </Panel>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-2 rounded-[var(--radius-sm)] bg-[var(--card-raised)] p-3">
      <span className="text-[var(--accent)]">{icon}</span>
      <span>
        <span className="block text-xs text-[var(--muted-foreground)]">{label}</span>
        <span className="mt-0.5 block text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}
