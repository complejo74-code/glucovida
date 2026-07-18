"use client";

import { useEffect } from "react";

/**
 * Registra el Service Worker (paso 11). Se monta en el RootLayout y no pinta
 * nada. Solo en producción: en dev el cache-first de assets estorbaría al HMR.
 * Si el navegador no soporta Service Workers, no hace nada (uso normal intacto).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Falla abierto: si el registro falla, la app sigue funcionando igual
        // como web normal. No trabamos al usuario por un problema del SW.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
