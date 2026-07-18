"use client";

import { useEffect, useState } from "react";

type Phase = "hidden" | "shown" | "fading";

/** ¿La app está corriendo como PWA instalada (standalone)? */
function esStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    iosStandalone === true
  );
}

/**
 * Splash de marca (paso 11 R5). Solo aparece cuando la app se abrió INSTALADA
 * (standalone); en el navegador normal no se monta nunca, así que el uso web
 * queda idéntico (R6). Fondo gradiente celeste→blanco de marca + el corazón
 * 🩵, y se desvanece solo tras un instante. Se mantiene oculto en SSR y en el
 * primer render del cliente para no romper la hidratación.
 */
export function SplashScreen() {
  const [phase, setPhase] = useState<Phase>("hidden");

  useEffect(() => {
    if (!esStandalone()) return;
    // Mostrar en el próximo frame (no setState sincrónico dentro del effect).
    const raf = requestAnimationFrame(() => setPhase("shown"));
    const toFade = setTimeout(() => setPhase("fading"), 700);
    const toHide = setTimeout(() => setPhase("hidden"), 1050);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(toFade);
      clearTimeout(toHide);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-section transition-opacity duration-300 ${
        phase === "fading" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex size-20 items-center justify-center rounded-circle bg-primary-air text-4xl">
        🩵
      </div>
      <p className="mt-4 text-2xl font-black leading-title text-text">
        GlucoVida
      </p>
    </div>
  );
}
