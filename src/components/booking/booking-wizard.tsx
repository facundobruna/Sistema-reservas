"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CalendarDots,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  ForkKnife,
  MapPin,
  NotePencil,
  ShieldCheck,
  User,
  UsersThree,
  WarningCircle
} from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Field, Skeleton, inputClassName } from "@/components/ui/field";
import type { PublicRestaurant } from "@/features/repositories";
import type { Locale } from "@/lib/i18n";

const steps = ["party", "date", "time", "zone", "details", "requests", "confirm"] as const;
type Step = (typeof steps)[number];

type AvailabilityResponse = {
  slots: Array<{ time: string; serviceId: string }>;
};

type ReservationResponse = {
  reservation: {
    id: string;
    startsAt: string;
    endsAt?: string;
    partySize: number;
    serviceId?: string | null;
    zoneId?: string | null;
  };
  dinerToken?: string;
};

type WaitlistResponse = {
  entry: {
    id: string;
    status: string;
    date: string;
    partySize: number;
    preferredTime?: string | null;
    serviceId?: string | null;
    zoneId?: string | null;
  };
};

const copy = {
  es: {
    shellKicker: "Reserva guiada",
    shellTitle: "Elegimos la mejor mesa disponible para tu grupo.",
    shellBody: "El horario se vuelve a validar al confirmar, asi evitamos dobles reservas incluso cuando varias personas reservan al mismo tiempo.",
    stepWord: "Paso",
    summary: "Tu seleccion",
    party: "Comensales",
    partyTitle: "¿Cuantas personas vienen?",
    partyBody: "Usamos el tamano del grupo para sugerir una unidad que no desperdicie mesas grandes.",
    date: "Fecha",
    dateTitle: "Elegí el día",
    dateBody: "Mostramos horarios en la zona horaria del restaurante.",
    time: "Horario",
    timeTitle: "Elegí un horario",
    timeBody: "Cada opcion respeta disponibilidad de mesa y ritmo de cocina.",
    zone: "Zona",
    zoneTitle: "Preferencia de salon",
    zoneBody: "Si no tenes preferencia, podemos asignarte el mejor lugar disponible.",
    details: "Datos",
    detailsTitle: "Datos de contacto",
    detailsBody: "El telefono es necesario para gestionar la reserva y enviar recordatorios.",
    requests: "Pedidos",
    requestsTitle: "Algo que el equipo deba saber",
    requestsBody: "Celebraciones, accesibilidad o una mesa tranquila. No prometemos disponibilidad, pero lo dejamos visible.",
    confirm: "Confirmar",
    confirmTitle: "Revisá y confirmá",
    confirmBody: "Vamos a validar el horario una vez mas antes de guardar la reserva.",
    confirmedTitle: "Reserva confirmada",
    confirmedBody: "Te enviamos la confirmacion por email si dejaste una direccion.",
    name: "Nombre",
    email: "Email",
    phone: "Telefono",
    optionalEmail: "Opcional, pero recomendado para confirmaciones.",
    invalidEmail: "Ingresá un email válido o dejalo vacío.",
    requiredPhone: "Ingresá un telefono valido.",
    requiredName: "Ingresá tu nombre.",
    specialRequests: "Requerimientos especiales",
    noSlotsTitle: "No hay horarios para esa combinacion",
    noSlotsBody: "Probá otra fecha, cambia la cantidad de comensales o dejá la zona abierta.",
    loadingSlots: "Buscando mesas disponibles",
    errorSlots: "No pudimos consultar la disponibilidad",
    retry: "Reintentar",
    anyZone: "Cualquier zona",
    noPreference: "Sin preferencia",
    selected: "Seleccionado",
    back: "Atras",
    next: "Continuar",
    confirming: "Confirmando",
    complete: "Confirmar reserva",
    reservationCode: "Codigo de reserva",
    editSelection: "Editar seleccion",
    calendar: "Abrir en Google Calendar",
    downloadIcs: "Descargar .ics",
    manageReservation: "Gestionar reserva",
    waitlistTitle: "Sumate a la lista de espera",
    waitlistBody: "Te avisamos cuando se libere un horario compatible con tu grupo.",
    joinWaitlist: "Anotarme",
    joiningWaitlist: "Anotando",
    waitlistSuccess: "Ya estas en lista de espera.",
    waitlistCode: "Codigo de lista",
    service: "Servicio",
    unavailable: "Ese horario acaba de ocuparse. Elegí otro para seguir.",
    trust: ["Disponibilidad en vivo", "Sin doble booking", "Recordatorio por email"]
  },
  en: {
    shellKicker: "Guided booking",
    shellTitle: "We choose the best available table for your party.",
    shellBody: "The time is checked again at confirmation, so the room cannot be double-booked even under concurrent bookings.",
    stepWord: "Step",
    summary: "Your selection",
    party: "Guests",
    partyTitle: "How many guests are coming?",
    partyBody: "Party size helps us suggest a table unit without wasting larger tables.",
    date: "Date",
    dateTitle: "Choose the day",
    dateBody: "Times are shown in the restaurant local timezone.",
    time: "Time",
    timeTitle: "Choose a time",
    timeBody: "Every option respects table inventory and kitchen pacing.",
    zone: "Area",
    zoneTitle: "Dining-room preference",
    zoneBody: "If you have no preference, we can assign the best available spot.",
    details: "Details",
    detailsTitle: "Contact details",
    detailsBody: "Phone is required to manage the booking and send reminders.",
    requests: "Requests",
    requestsTitle: "Anything the team should know",
    requestsBody: "Celebrations, accessibility, or a quiet table. We cannot promise availability, but the team will see it.",
    confirm: "Confirm",
    confirmTitle: "Review and confirm",
    confirmBody: "We will validate the time once more before saving the reservation.",
    confirmedTitle: "Reservation confirmed",
    confirmedBody: "We sent the confirmation by email if you added an address.",
    name: "Name",
    email: "Email",
    phone: "Phone",
    optionalEmail: "Optional, but recommended for confirmations.",
    invalidEmail: "Enter a valid email or leave it empty.",
    requiredPhone: "Enter a valid phone number.",
    requiredName: "Enter your name.",
    specialRequests: "Special requests",
    noSlotsTitle: "No times for that combination",
    noSlotsBody: "Try another date, change party size, or leave the area open.",
    loadingSlots: "Looking for available tables",
    errorSlots: "We could not check availability",
    retry: "Try again",
    anyZone: "Any area",
    noPreference: "No preference",
    selected: "Selected",
    back: "Back",
    next: "Continue",
    confirming: "Confirming",
    complete: "Confirm reservation",
    reservationCode: "Reservation code",
    editSelection: "Edit selection",
    calendar: "Open in Google Calendar",
    downloadIcs: "Download .ics",
    manageReservation: "Manage reservation",
    waitlistTitle: "Join the waitlist",
    waitlistBody: "We will notify you when a compatible time opens for your party.",
    joinWaitlist: "Join waitlist",
    joiningWaitlist: "Joining",
    waitlistSuccess: "You are on the waitlist.",
    waitlistCode: "Waitlist code",
    service: "Service",
    unavailable: "That time was just taken. Choose another time to continue.",
    trust: ["Live availability", "No double booking", "Email reminder"]
  }
} as const;

function todayIn(timezone: string) {
  return DateTime.now().setZone(timezone).toISODate() ?? "";
}

function isValidEmail(value: string) {
  return value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function googleCalendarUrl(restaurant: PublicRestaurant, reservation?: ReservationResponse["reservation"]) {
  if (!reservation) return "#";
  const start = DateTime.fromISO(reservation.startsAt).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const end = DateTime.fromISO(reservation.endsAt ?? reservation.startsAt).toUTC().toFormat("yyyyLLdd'T'HHmmss'Z'");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Reserva en ${restaurant.name}`,
    dates: `${start}/${end}`,
    details: `Reserva para ${reservation.partySize} personas.`,
    location: restaurant.name
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function reservationManageUrl(restaurant: PublicRestaurant, locale: Locale, data: ReservationResponse) {
  const params = new URLSearchParams({ locale });
  if (data.dinerToken) params.set("token", data.dinerToken);
  return `/r/${restaurant.slug}/reservations/${data.reservation.id}?${params.toString()}`;
}

function reservationCalendarUrl(restaurant: PublicRestaurant, data: ReservationResponse) {
  const params = new URLSearchParams();
  if (data.dinerToken) params.set("token", data.dinerToken);
  const query = params.toString();
  return `/api/v1/r/${restaurant.slug}/reservations/${data.reservation.id}/calendar${query ? `?${query}` : ""}`;
}

export function BookingWizard({ restaurant, locale }: { restaurant: PublicRestaurant; locale: Locale }) {
  const c = copy[locale];
  const router = useRouter();
  const search = useSearchParams();
  const initialDate = todayIn(restaurant.timezone);
  const step = steps.includes(search.get("step") as Step) ? (search.get("step") as Step) : "party";
  const partySize = Number(search.get("party") ?? 2);
  const date = search.get("date") ?? initialDate;
  const time = search.get("time");
  const zoneId = search.get("zoneId");
  const serviceId = search.get("serviceId");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [specialRequests, setSpecialRequests] = useState("");

  const params = useMemo(() => new URLSearchParams(search.toString()), [search]);
  const currentIndex = Math.max(0, steps.indexOf(step));
  const needsZone = restaurant.zones.length > 1;
  const selectedZone = restaurant.zones.find((zone) => zone.id === zoneId);
  const selectedService = restaurant.services.find((service) => service.id === serviceId);
  const selectedTimeLabel = time ? DateTime.fromISO(time).setZone(restaurant.timezone).toFormat("HH:mm") : null;
  const nameValid = customer.name.trim().length > 1;
  const phoneValid = customer.phone.trim().length >= 7;
  const emailValid = isValidEmail(customer.email.trim());

  function push(next: URLSearchParams) {
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    push(next);
  }

  function setParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    push(next);
  }

  function go(nextStep: Step) {
    const next = new URLSearchParams(params.toString());
    next.set("step", nextStep);
    push(next);
  }

  function nextStep() {
    if (step === "time" && !needsZone) return "details";
    return steps[currentIndex + 1] ?? "confirm";
  }

  function prevStep() {
    if (step === "details" && !needsZone) return "time";
    return steps[currentIndex - 1] ?? "party";
  }

  const availability = useQuery({
    queryKey: ["availability", restaurant.slug, date, partySize, zoneId, serviceId],
    enabled: Boolean(date && partySize),
    queryFn: async () => {
      const query = new URLSearchParams({
        date,
        partySize: String(partySize)
      });
      if (zoneId) query.set("zoneId", zoneId);
      if (serviceId) query.set("serviceId", serviceId);
      const response = await fetch(`/api/v1/r/${restaurant.slug}/availability?${query.toString()}`);
      if (!response.ok) throw new Error("availability_failed");
      return (await response.json()) as AvailabilityResponse;
    }
  });

  const createReservation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/r/${restaurant.slug}/reservations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          time,
          partySize,
          zoneId: zoneId || null,
          serviceId: serviceId || null,
          customer: {
            name: customer.name.trim(),
            email: customer.email.trim() || null,
            phone: customer.phone.trim()
          },
          specialRequests: specialRequests.trim() || null
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? c.unavailable);
      }
      return (await response.json()) as ReservationResponse;
    },
    onSuccess: () => go("confirm")
  });

  const selectedSlot = availability.data?.slots.find((slot) => slot.time === time);
  const canProceed =
    (step === "party" && partySize > 0) ||
    (step === "date" && Boolean(date)) ||
    (step === "time" && Boolean(selectedSlot)) ||
    (step === "zone" && (!needsZone || Boolean(zoneId))) ||
    (step === "details" && nameValid && phoneValid && emailValid) ||
    step === "requests";

  return (
    <div className="reveal-in reveal-delay-1">
      <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--card)] shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-4 bg-[linear-gradient(to_bottom,var(--accent-soft),transparent)] px-5 pb-4 pt-5 sm:px-7 sm:pt-6">
          <p className="font-mono text-xs text-[var(--muted-foreground)]">
            {c.stepWord} {currentIndex + 1} / {steps.length}
          </p>
          <div className="flex items-center gap-1.5">
            {steps.map((item, index) => (
              <span
                aria-label={c[item]}
                className={`h-1 rounded-full transition-all duration-300 ease-[var(--ease-press)] ${
                  index <= currentIndex ? "w-6 bg-[var(--accent)]" : "w-3 bg-[var(--border-strong)]"
                }`}
                key={item}
              />
            ))}
          </div>
        </div>

        <div className="px-5 py-7 sm:px-7 sm:py-8">
          <div className="min-h-[22rem]">
            <StepContent
              availability={availability}
              c={c}
              createReservation={createReservation}
              customer={customer}
              date={date}
              emailValid={emailValid}
              initialDate={initialDate}
              locale={locale}
              nameValid={nameValid}
              needsZone={needsZone}
              partySize={partySize}
              phoneValid={phoneValid}
              restaurant={restaurant}
              serviceId={serviceId}
              selectedSlot={selectedSlot}
              selectedZone={selectedZone}
              setCustomer={setCustomer}
              setParam={setParam}
              setParams={setParams}
              setSpecialRequests={setSpecialRequests}
              specialRequests={specialRequests}
              step={step}
              time={time}
              zoneId={zoneId}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] px-5 py-4 sm:px-7">
          <SummaryItem icon={<UsersThree size={14} weight="bold" />} label={c.party} value={String(partySize)} />
          <SummaryItem icon={<CalendarDots size={14} weight="bold" />} label={c.date} value={DateTime.fromISO(date).setLocale(locale).toFormat("dd LLL")} />
          {selectedTimeLabel ? <SummaryItem icon={<Clock size={14} weight="bold" />} label={c.time} value={selectedTimeLabel} /> : null}
          {needsZone ? <SummaryItem icon={<MapPin size={14} weight="bold" />} label={c.zone} value={selectedZone?.name ?? c.anyZone} /> : null}
          {selectedService ? <SummaryItem icon={<ForkKnife size={14} weight="bold" />} label={c.service} value={selectedService.name} /> : null}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 sm:px-7">
          <Button disabled={currentIndex === 0 || createReservation.isPending} variant="ghost" onClick={() => go(prevStep())}>
            <CaretLeft size={18} weight="bold" />
            {c.back}
          </Button>
          {step === "confirm" ? (
            createReservation.data ? (
              <Button variant="secondary" onClick={() => go("time")}>
                {c.editSelection}
              </Button>
            ) : (
              <Button
                disabled={!time || !nameValid || !phoneValid || !emailValid || createReservation.isPending || (needsZone && !zoneId)}
                onClick={() => createReservation.mutate()}
              >
                <CheckCircle size={18} weight="bold" />
                {createReservation.isPending ? c.confirming : c.complete}
              </Button>
            )
          ) : (
            <Button disabled={!canProceed || createReservation.isPending} onClick={() => go(nextStep())}>
              {c.next}
              <CaretRight size={18} weight="bold" />
            </Button>
          )}
        </footer>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {c.trust.map((item) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]" key={item}>
            <ShieldCheck size={14} weight="duotone" className="text-[var(--accent)]" />
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepContent(props: {
  availability: ReturnType<typeof useQuery<AvailabilityResponse>>;
  c: (typeof copy)[Locale];
  createReservation: ReturnType<typeof useMutation<ReservationResponse, Error, void>>;
  customer: { name: string; email: string; phone: string };
  date: string;
  emailValid: boolean;
  initialDate: string;
  locale: Locale;
  nameValid: boolean;
  needsZone: boolean;
  partySize: number;
  phoneValid: boolean;
  restaurant: PublicRestaurant;
  serviceId: string | null;
  selectedSlot?: { time: string; serviceId: string };
  selectedZone?: { id: string; name: string };
  setCustomer: (value: { name: string; email: string; phone: string }) => void;
  setParam: (key: string, value: string | null) => void;
  setParams: (values: Record<string, string | null>) => void;
  setSpecialRequests: (value: string) => void;
  specialRequests: string;
  step: Step;
  time: string | null;
  zoneId: string | null;
}) {
  const {
    availability,
    c,
    createReservation,
    customer,
    date,
    emailValid,
    initialDate,
    locale,
    nameValid,
    partySize,
    phoneValid,
    restaurant,
    serviceId,
    setCustomer,
    setParam,
    setParams,
    setSpecialRequests,
    specialRequests,
    step,
    time,
    zoneId
  } = props;

  if (step === "party") {
    return (
      <StepFrame body={c.partyBody} icon={<UsersThree size={24} weight="duotone" />} title={c.partyTitle}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
            <button
              className={`grid aspect-square place-items-center rounded-[var(--radius-md)] border text-xl font-medium transition-colors duration-150 ${
                partySize === value
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
              }`}
              key={value}
              onClick={() => setParam("party", String(value))}
              type="button"
            >
              {value}
            </button>
          ))}
        </div>
      </StepFrame>
    );
  }

  if (step === "date") {
    return (
      <StepFrame body={c.dateBody} icon={<CalendarDots size={24} weight="duotone" />} title={c.dateTitle}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label={c.date}>
            <input className={inputClassName} min={initialDate} type="date" value={date} onChange={(event) => setParam("date", event.target.value)} />
          </Field>
          <Badge>{restaurant.timezone}</Badge>
        </div>
        <QuickDates initialDate={initialDate} locale={locale} setDate={(value) => setParam("date", value)} />
      </StepFrame>
    );
  }

  if (step === "time") {
    return (
      <StepFrame body={c.timeBody} icon={<Clock size={24} weight="duotone" />} title={c.timeTitle}>
        {availability.isLoading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <Skeleton className="h-14" key={index} />
            ))}
          </div>
        ) : null}
        {availability.isError ? (
          <EmptyState
            title={c.errorSlots}
            description={c.unavailable}
            action={
              <Button variant="secondary" onClick={() => availability.refetch()}>
                <WarningCircle size={18} weight="duotone" />
                {c.retry}
              </Button>
            }
          />
        ) : null}
        {!availability.isLoading && !availability.isError && availability.data?.slots.length === 0 ? (
          <div className="grid gap-3">
            <EmptyState title={c.noSlotsTitle} description={c.noSlotsBody} />
            <WaitlistForm
              c={c}
              customer={customer}
              date={date}
              emailValid={emailValid}
              nameValid={nameValid}
              partySize={partySize}
              phoneValid={phoneValid}
              restaurant={restaurant}
              serviceId={serviceId}
              setCustomer={setCustomer}
              setSpecialRequests={setSpecialRequests}
              specialRequests={specialRequests}
              zoneId={zoneId}
            />
          </div>
        ) : null}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {availability.data?.slots.map((slot) => {
            const local = DateTime.fromISO(slot.time).setZone(restaurant.timezone);
            const service = restaurant.services.find((item) => item.id === slot.serviceId);
            const active = time === slot.time;
            return (
              <button
                className={`grid gap-0.5 rounded-[var(--radius-md)] border px-4 py-3 text-left transition-colors duration-150 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
                }`}
                key={slot.time}
                onClick={() => setParams({ time: slot.time, serviceId: slot.serviceId })}
                type="button"
              >
                <span className={`font-mono text-base font-semibold ${active ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>{local.toFormat("HH:mm")}</span>
                <span className="text-xs text-[var(--muted-foreground)]">{service?.name ?? c.service}</span>
              </button>
            );
          })}
        </div>
      </StepFrame>
    );
  }

  if (step === "zone") {
    return (
      <StepFrame body={c.zoneBody} icon={<MapPin size={24} weight="duotone" />} title={c.zoneTitle}>
        <div className="grid gap-2">
          <button
            className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-4 text-left transition-colors duration-150 ${
              !zoneId
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
            }`}
            onClick={() => setParam("zoneId", null)}
            type="button"
          >
            <span>
              <span className={`block font-medium ${!zoneId ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>{c.noPreference}</span>
              <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{c.anyZone}</span>
            </span>
            {!zoneId ? <CheckCircle size={20} weight="fill" className="shrink-0 text-[var(--accent)]" /> : null}
          </button>
          {restaurant.zones.map((zone) => {
            const active = zoneId === zone.id;
            return (
              <button
                className={`flex items-center justify-between gap-3 rounded-[var(--radius-md)] border px-4 py-4 text-left transition-colors duration-150 ${
                  active
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
                }`}
                key={zone.id}
                onClick={() => setParam("zoneId", zone.id)}
                type="button"
              >
                <span>
                  <span className={`block font-medium ${active ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}>{zone.name}</span>
                  <span className="mt-0.5 block text-sm text-[var(--muted-foreground)]">{active ? c.selected : c.zone}</span>
                </span>
                {active ? <CheckCircle size={20} weight="fill" className="shrink-0 text-[var(--accent)]" /> : null}
              </button>
            );
          })}
        </div>
      </StepFrame>
    );
  }

  if (step === "details") {
    return (
      <StepFrame body={c.detailsBody} icon={<User size={24} weight="duotone" />} title={c.detailsTitle}>
        <div className="grid gap-4">
          <Field hint={!nameValid && customer.name ? c.requiredName : undefined} label={c.name}>
            <input
              className={inputClassName}
              value={customer.name}
              onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
            />
          </Field>
          <Field hint={c.optionalEmail} label={c.email}>
            <input
              className={inputClassName}
              type="email"
              value={customer.email}
              onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
            />
          </Field>
          {!emailValid ? <p className="text-sm text-[var(--danger)]">{c.invalidEmail}</p> : null}
          <Field hint={!phoneValid && customer.phone ? c.requiredPhone : undefined} label={c.phone}>
            <input
              className={inputClassName}
              inputMode="tel"
              value={customer.phone}
              onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
            />
          </Field>
        </div>
      </StepFrame>
    );
  }

  if (step === "requests") {
    return (
      <StepFrame body={c.requestsBody} icon={<NotePencil size={24} weight="duotone" />} title={c.requestsTitle}>
        <Field label={c.specialRequests}>
          <textarea
            className={`${inputClassName} min-h-40 py-3`}
            value={specialRequests}
            onChange={(event) => setSpecialRequests(event.target.value)}
          />
        </Field>
      </StepFrame>
    );
  }

  return (
    <StepFrame body={createReservation.data ? c.confirmedBody : c.confirmBody} icon={<CheckCircle size={24} weight="duotone" />} title={createReservation.data ? c.confirmedTitle : c.confirmTitle}>
      {createReservation.data ? (
        <div className="grid gap-4">
          <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--success)_30%,var(--border))] bg-[color-mix(in_srgb,var(--success)_8%,var(--card))] p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--success)]">
              <CheckCircle size={18} weight="fill" />
              {c.reservationCode}
            </p>
            <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">{createReservation.data.reservation.id}</p>
          </div>
          <div className="grid gap-2">
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium transition-colors hover:bg-[var(--muted)]" href={reservationManageUrl(restaurant, locale, createReservation.data)}>
              <NotePencil size={18} weight="duotone" />
              {c.manageReservation}
            </a>
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium transition-colors hover:bg-[var(--muted)]" href={reservationCalendarUrl(restaurant, createReservation.data)}>
              <CalendarDots size={18} weight="duotone" />
              {c.downloadIcs}
            </a>
            <a className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium transition-colors hover:bg-[var(--muted)]" href={googleCalendarUrl(restaurant, createReservation.data.reservation)} rel="noreferrer" target="_blank">
              <CalendarDots size={18} weight="duotone" />
              {c.calendar}
            </a>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] px-4">
            <SummaryRow label={c.party} value={String(props.partySize)} />
            <SummaryRow label={c.date} value={DateTime.fromISO(props.date).setLocale(props.locale).toFormat("DDDD")} />
            <SummaryRow label={c.time} value={props.time ? DateTime.fromISO(props.time).setZone(props.restaurant.timezone).toFormat("HH:mm") : "-"} />
            <SummaryRow label={c.zone} value={props.selectedZone?.name ?? c.anyZone} />
          </div>
          {createReservation.error ? (
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,var(--border))] bg-[color-mix(in_srgb,var(--danger)_8%,var(--card))] p-4 text-sm text-[var(--danger)]">
              {createReservation.error.message}
            </div>
          ) : null}
        </div>
      )}
    </StepFrame>
  );
}

function WaitlistForm({
  c,
  customer,
  date,
  emailValid,
  nameValid,
  partySize,
  phoneValid,
  restaurant,
  serviceId,
  setCustomer,
  setSpecialRequests,
  specialRequests,
  zoneId
}: {
  c: (typeof copy)[Locale];
  customer: { name: string; email: string; phone: string };
  date: string;
  emailValid: boolean;
  nameValid: boolean;
  partySize: number;
  phoneValid: boolean;
  restaurant: PublicRestaurant;
  serviceId: string | null;
  setCustomer: (value: { name: string; email: string; phone: string }) => void;
  setSpecialRequests: (value: string) => void;
  specialRequests: string;
  zoneId: string | null;
}) {
  const waitlist = useMutation<WaitlistResponse, Error, void>({
    mutationFn: async () => {
      const response = await fetch(`/api/v1/r/${restaurant.slug}/waitlist`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date,
          partySize,
          zoneId: zoneId || null,
          serviceId: serviceId || null,
          preferredTime: null,
          customer: {
            name: customer.name.trim(),
            email: customer.email.trim() || null,
            phone: customer.phone.trim()
          },
          specialRequests: specialRequests.trim() || null
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? c.unavailable);
      }
      return (await response.json()) as WaitlistResponse;
    }
  });

  if (waitlist.data) {
    return (
      <div className="rounded-[var(--radius-lg)] bg-[color-mix(in_srgb,var(--success)_14%,var(--card-raised))] p-5 text-left">
        <p className="text-sm font-semibold text-[var(--success)]">{c.waitlistSuccess}</p>
        <p className="mt-2 text-xs uppercase text-[var(--muted-foreground)]">{c.waitlistCode}</p>
        <p className="mt-1 break-all font-mono text-sm">{waitlist.data.entry.id}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4 text-left">
      <div>
        <h4 className="text-xl font-semibold">{c.waitlistTitle}</h4>
        <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{c.waitlistBody}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field hint={!nameValid && customer.name ? c.requiredName : undefined} label={c.name}>
          <input className={inputClassName} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
        </Field>
        <Field hint={c.optionalEmail} label={c.email}>
          <input className={inputClassName} type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
        </Field>
        <Field hint={!phoneValid && customer.phone ? c.requiredPhone : undefined} label={c.phone}>
          <input className={inputClassName} inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
        </Field>
      </div>
      {!emailValid ? <p className="text-sm text-[var(--danger)]">{c.invalidEmail}</p> : null}
      <Field label={c.specialRequests}>
        <textarea className={`${inputClassName} min-h-24 py-3`} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} />
      </Field>
      {waitlist.error ? (
        <div className="rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--danger)_10%,var(--card-raised))] p-3 text-sm text-[var(--danger)]">
          {waitlist.error.message}
        </div>
      ) : null}
      <div>
        <Button disabled={!nameValid || !phoneValid || !emailValid || waitlist.isPending} onClick={() => waitlist.mutate()}>
          <CheckCircle size={18} weight="bold" />
          {waitlist.isPending ? c.joiningWaitlist : c.joinWaitlist}
        </Button>
      </div>
    </div>
  );
}

function StepFrame({ body, children, icon, title }: { body: string; children: React.ReactNode; icon: React.ReactNode; title: string }) {
  return (
    <section className="reveal-in grid gap-6">
      <div className="grid gap-2">
        <span className="text-[var(--accent)]" aria-hidden>
          {icon}
        </span>
        <h3 className="text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">{title}</h3>
        <p className="max-w-xl text-sm leading-7 text-[var(--muted-foreground)]">{body}</p>
      </div>
      {children}
    </section>
  );
}

function QuickDates({
  initialDate,
  locale,
  setDate
}: {
  initialDate: string;
  locale: Locale;
  setDate: (value: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((offset) => {
        const date = DateTime.fromISO(initialDate).plus({ days: offset });
        return (
          <button
            className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-left transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-[var(--muted)]"
            key={offset}
            onClick={() => setDate(date.toISODate() ?? initialDate)}
            type="button"
          >
            <span className="block font-mono text-sm">{date.setLocale(locale).toFormat("dd LLL")}</span>
            <span className="mt-1 block text-xs text-[var(--muted-foreground)]">{date.setLocale(locale).toFormat("ccc")}</span>
          </button>
        );
      })}
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--muted)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)]"
      title={label}
    >
      <span className="text-[var(--accent)]" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {value}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] py-3 text-sm last:border-b-0">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
