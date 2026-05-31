"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDots, CaretLeft, CaretRight, CheckCircle, Clock, MapPin, UsersThree } from "@phosphor-icons/react";
import { DateTime } from "luxon";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Panel, inputClassName } from "@/components/ui/field";
import type { PublicRestaurant } from "@/features/repositories";

const steps = ["party", "date", "time", "zone", "details", "requests", "confirm"] as const;
type Step = (typeof steps)[number];

type AvailabilityResponse = {
  slots: Array<{ time: string; serviceId: string }>;
};

type ReservationResponse = {
  reservation: {
    id: string;
    startsAt: string;
    partySize: number;
  };
};

function todayIn(timezone: string) {
  return DateTime.now().setZone(timezone).toISODate() ?? "";
}

export function BookingWizard({ restaurant }: { restaurant: PublicRestaurant }) {
  const router = useRouter();
  const search = useSearchParams();
  const initialDate = todayIn(restaurant.timezone);
  const step = (search.get("step") as Step | null) ?? "party";
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

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function setParams(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    router.push(`?${next.toString()}`, { scroll: false });
  }

  function go(nextStep: Step) {
    const next = new URLSearchParams(params.toString());
    next.set("step", nextStep);
    router.push(`?${next.toString()}`, { scroll: false });
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
          customer,
          specialRequests: specialRequests || null
        })
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "reservation_failed");
      }
      return (await response.json()) as ReservationResponse;
    },
    onSuccess: () => go("confirm")
  });

  const selectedSlot = availability.data?.slots.find((slot) => slot.time === time);

  return (
    <Panel className="grid min-h-[640px] content-between overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase text-[var(--muted-foreground)]">Paso {currentIndex + 1} / 7</p>
            <h2 className="mt-1 text-xl font-semibold">Reserva</h2>
          </div>
          <div className="flex gap-1">
            {steps.map((item, index) => (
              <span
                aria-label={item}
                className={`h-2 w-6 rounded-full ${index <= currentIndex ? "bg-[var(--accent)]" : "bg-[var(--muted)]"}`}
                key={item}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:px-6">
        {step === "party" ? (
          <section className="grid gap-5">
            <StepHeading icon={<UsersThree size={22} weight="duotone" />} title="Comensales" />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => (
                <Button
                  key={value}
                  variant={partySize === value ? "primary" : "secondary"}
                  onClick={() => setParam("party", String(value))}
                >
                  {value}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        {step === "date" ? (
          <section className="grid gap-5">
            <StepHeading icon={<CalendarDots size={22} weight="duotone" />} title="Fecha" />
            <Field label="Fecha">
              <input className={inputClassName} min={initialDate} type="date" value={date} onChange={(event) => setParam("date", event.target.value)} />
            </Field>
          </section>
        ) : null}

        {step === "time" ? (
          <section className="grid gap-5">
            <StepHeading icon={<Clock size={22} weight="duotone" />} title="Horario" />
            {availability.isLoading ? <p className="text-sm text-[var(--muted-foreground)]">Buscando horarios...</p> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {availability.data?.slots.map((slot) => {
                const local = DateTime.fromISO(slot.time).setZone(restaurant.timezone);
                return (
                  <Button
                    key={slot.time}
                    variant={time === slot.time ? "primary" : "secondary"}
                    onClick={() => {
                      setParams({ time: slot.time, serviceId: slot.serviceId });
                    }}
                  >
                    {local.toFormat("HH:mm")}
                  </Button>
                );
              })}
            </div>
            {!availability.isLoading && !availability.data?.slots.length ? (
              <p className="text-sm text-[var(--muted-foreground)]">No hay horarios disponibles.</p>
            ) : null}
          </section>
        ) : null}

        {step === "zone" ? (
          <section className="grid gap-5">
            <StepHeading icon={<MapPin size={22} weight="duotone" />} title="Zona" />
            <div className="grid gap-2">
              {restaurant.zones.map((zone) => (
                <Button
                  className="justify-start"
                  key={zone.id}
                  variant={zoneId === zone.id ? "primary" : "secondary"}
                  onClick={() => setParam("zoneId", zone.id)}
                >
                  {zone.name}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        {step === "details" ? (
          <section className="grid gap-4">
            <StepHeading icon={<UsersThree size={22} weight="duotone" />} title="Tus datos" />
            <Field label="Nombre">
              <input className={inputClassName} value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
            </Field>
            <Field label="Email">
              <input className={inputClassName} type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} />
            </Field>
            <Field label="Telefono">
              <input className={inputClassName} inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
            </Field>
          </section>
        ) : null}

        {step === "requests" ? (
          <section className="grid gap-5">
            <StepHeading icon={<CheckCircle size={22} weight="duotone" />} title="Requerimientos" />
            <Field label="Opcional">
              <textarea className={`${inputClassName} min-h-32 py-3`} value={specialRequests} onChange={(event) => setSpecialRequests(event.target.value)} />
            </Field>
          </section>
        ) : null}

        {step === "confirm" ? (
          <section className="grid gap-4">
            <StepHeading icon={<CheckCircle size={22} weight="duotone" />} title="Confirmacion" />
            {createReservation.data ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--muted)] p-4">
                <p className="font-semibold">Reserva confirmada</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">Codigo: {createReservation.data.reservation.id}</p>
              </div>
            ) : (
              <div className="grid gap-3 text-sm">
                <Summary label="Comensales" value={String(partySize)} />
                <Summary label="Fecha" value={date} />
                <Summary label="Horario" value={time ? DateTime.fromISO(time).setZone(restaurant.timezone).toFormat("HH:mm") : "-"} />
                <Summary label="Zona" value={restaurant.zones.find((zone) => zone.id === zoneId)?.name ?? "Cualquier zona"} />
                {createReservation.error ? <p className="text-[var(--danger)]">{createReservation.error.message}</p> : null}
              </div>
            )}
          </section>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[var(--border)] px-4 py-4 sm:px-6">
        <Button disabled={currentIndex === 0 || createReservation.isPending} variant="ghost" onClick={() => go(steps[currentIndex - 1])}>
          <CaretLeft size={18} weight="bold" />
          Atras
        </Button>
        {step === "confirm" && !createReservation.data ? (
          <Button
            disabled={!time || !customer.name || !customer.phone || createReservation.isPending || (needsZone && !zoneId)}
            onClick={() => createReservation.mutate()}
          >
            <CheckCircle size={18} weight="bold" />
            {createReservation.isPending ? "Confirmando..." : "Confirmar"}
          </Button>
        ) : step === "confirm" ? null : (
          <Button
            disabled={
              (step === "time" && !selectedSlot) ||
              (step === "zone" && needsZone && !zoneId) ||
              (step === "details" && (!customer.name || !customer.phone))
            }
            onClick={() => {
              if (step === "time" && !needsZone) go("details");
              else go(steps[currentIndex + 1]);
            }}
          >
            Siguiente
            <CaretRight size={18} weight="bold" />
          </Button>
        )}
      </div>
    </Panel>
  );
}

function StepHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--accent)]">{icon}</div>
      <h3 className="text-2xl font-semibold">{title}</h3>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[var(--border)] bg-white px-3 py-2">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
