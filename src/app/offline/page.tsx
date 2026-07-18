"use client";

import { Button } from "@/components/ui/button";

/**
 * Página offline (paso 11, edge case). La sirve el Service Worker cuando una
 * navegación falla por falta de red. Tono del branding (docs/BRANDING.md §9):
 * cálido y acompañante, nunca un error crudo ni una pantalla en blanco.
 * No muestra ningún dato del usuario — es estática y segura de cachear.
 */
export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-gradient-section px-4 py-12 text-center">
      <div
        aria-hidden
        className="mb-4 flex size-16 items-center justify-center rounded-circle bg-primary-air text-3xl"
      >
        🩵
      </div>
      <h1 className="text-2xl font-black leading-title text-text">
        Sin conexión, ya volvemos
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-body text-muted">
        Parece que te quedaste sin internet. No te preocupes: en cuanto vuelva
        la conexión, seguimos donde estábamos.
      </p>
      <div className="mt-6">
        <Button
          type="button"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Reintentar
        </Button>
      </div>
    </div>
  );
}
