"use client";

import Link from "next/link";
import { Cookie, X } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "mesa_clara_cookie_consent_v1";

type ConsentState = {
  necessary: true;
  analytics: boolean;
  acceptedAt: string;
};

function saveConsent(analytics: boolean) {
  const value: ConsentState = {
    necessary: true,
    analytics,
    acceptedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new Event("mesa-clara-cookie-consent"));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("mesa-clara-cookie-consent", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mesa-clara-cookie-consent", callback);
  };
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY) ? "accepted" : "missing";
}

function getServerSnapshot() {
  return "accepted";
}

export function CookieConsent() {
  const consent = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (consent !== "missing") return null;

  function choose(analytics: boolean) {
    saveConsent(analytics);
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--card-raised)] p-3 shadow-[var(--shadow)] sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-start">
        <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] bg-[var(--muted)] text-[var(--accent)]">
          <Cookie size={22} weight="duotone" />
        </span>
        <div>
          <p className="text-sm font-semibold">Cookies operativas</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
            Usamos cookies necesarias para sesiones, seguridad y reservas. Las analiticas quedan apagadas salvo que las aceptes.
            <Link className="ml-1 font-semibold text-[var(--foreground)] underline-offset-4 hover:underline" href="/legal/privacy">
              Ver privacidad
            </Link>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button size="sm" variant="quiet" onClick={() => choose(false)}>
            Solo necesarias
          </Button>
          <Button size="sm" onClick={() => choose(true)}>
            Aceptar
          </Button>
          <Button aria-label="Cerrar aviso de cookies" size="icon" variant="ghost" onClick={() => choose(false)}>
            <X size={17} weight="bold" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
