"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClassName } from "@/components/ui/field";

type Status = "idle" | "sending" | "sent" | "error";

export function PrivacyRequestForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/privacy/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: data.get("type"),
        restaurantSlug: data.get("restaurantSlug") || null,
        email: data.get("email") || null,
        phone: data.get("phone") || null,
        note: data.get("note") || null
      })
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { message?: string };
      setStatus("error");
      setMessage(body.message ?? "No pudimos registrar la solicitud.");
      return;
    }

    event.currentTarget.reset();
    setStatus("sent");
    setMessage("Solicitud registrada. El restaurante podra revisarla desde su panel operativo.");
  }

  return (
    <form className="grid gap-4 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-4 sm:p-5" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo">
          <select className={inputClassName} name="type" defaultValue="export">
            <option value="export">Exportar mis datos</option>
            <option value="delete">Borrar mis datos</option>
          </select>
        </Field>
        <Field label="Restaurante">
          <input className={inputClassName} name="restaurantSlug" placeholder="demo-bistro" required />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <input className={inputClassName} name="email" type="email" placeholder="nombre@email.com" />
        </Field>
        <Field label="Telefono">
          <input className={inputClassName} name="phone" placeholder="+549..." />
        </Field>
      </div>
      <Field label="Detalle">
        <textarea className={`${inputClassName} min-h-28 py-3`} name="note" placeholder="Datos para ubicar tu reserva o cuenta" />
      </Field>
      {message ? (
        <p className={status === "error" ? "text-sm text-[var(--danger)]" : "text-sm text-[var(--success)]"}>{message}</p>
      ) : null}
      <Button disabled={status === "sending"} type="submit">
        {status === "sending" ? "Registrando" : "Enviar solicitud"}
      </Button>
    </form>
  );
}
