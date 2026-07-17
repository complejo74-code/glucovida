import type { Config } from "tailwindcss";

/**
 * Tokens de diseño de GlucoVida. Fuente de verdad: docs/BRANDING.md.
 * Tailwind v4 los carga vía `@config` desde src/app/globals.css.
 * Nada de hex sueltos en el código de la app: todo sale de acá.
 *
 * LIGHT MODE PURO: no hay variantes dark, ni `darkMode`, ni fondos oscuros.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Paleta (11 colores) ──────────────────────────────────────────────
      colors: {
        primary: {
          DEFAULT: "#22A7E6", // primary
          strong: "#1D90C7", // primary-strong
          soft: "#A9DDF7", // primary-soft
          air: "#D6EEFB", // primary-air
          // Texto sobre el celeste de marca. Va OSCURO (#0F172A), no blanco:
          // sobre el gradiente #22A7E6→#1D90C7 el blanco daba 2.71–3.58:1
          // (falla AA); el texto oscuro da 4.99–6.58:1 y conserva el celeste.
          foreground: "#0F172A",
        },
        white: "#FFFFFF",
        text: "#0F172A",
        muted: "#5B6B7C",
        border: {
          // Divisor decorativo suave (tarjetas, separadores). 1.17:1 vs blanco:
          // NO sirve como único límite de un control (WCAG 1.4.11 pide 3:1).
          DEFAULT: "#E6EEF5",
          // Borde de controles interactivos (inputs, select, botón outline,
          // cards de opción). 3.17:1 vs blanco → cumple 1.4.11 para UI.
          strong: "#7A94A6",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },

      // ── Radios (5) ───────────────────────────────────────────────────────
      borderRadius: {
        card: "28px",
        input: "14px", // radio intermedio cómodo para inputs (ni sharp ni pill)
        bubble: "20px", // burbuja de chat: más suave que el input, más chico que
        //                 la card — con la esquina del emisor a 6px ("colita")
        pill: "999px",
        circle: "50%",
      },

      // ── Sombras celestes (2) ─────────────────────────────────────────────
      boxShadow: {
        "card-hover": "0 25px 50px rgba(34,167,230,0.08)",
        "btn-hover": "0 15px 35px rgba(34,167,230,0.25)",
      },

      // ── Gradientes (celeste → blanco, siempre) ───────────────────────────
      backgroundImage: {
        // CTA: celeste de marca. Lleva texto OSCURO (primary.foreground =
        // #0F172A) para pasar AA sin perder el celeste (ver ese token).
        "gradient-primary": "linear-gradient(180deg, #22A7E6, #1D90C7)",
        // Variante profunda para superficies donde el celeste claro no llega a
        // 3:1: relleno de la barra de progreso vs. el track primary-air
        // (#D6EEFB) → 4.38–5.35:1 (WCAG 1.4.11). No lleva texto encima.
        "gradient-strong": "linear-gradient(180deg, #17739F, #12658C)",
        "gradient-section":
          "linear-gradient(180deg, #D6EEFB 0%, #EBF6FD 55%, #FFFFFF 100%)",
      },

      // ── Tipografía ───────────────────────────────────────────────────────
      fontFamily: {
        sans: ["var(--font-nunito)", "system-ui", "sans-serif"],
      },
      lineHeight: {
        title: "1.1",
        body: "1.75",
      },

      // ── Animaciones (fade in + float, docs/BRANDING.md §1 "amable, con luz")
      // Suaves y cortas: acompañan, no distraen. Se anulan con
      // prefers-reduced-motion (ver globals.css).
      keyframes: {
        "fade-slide-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        // "Gluco está escribiendo": tres puntos con blink escalonado (no un
        // spinner genérico, ver spec 10B-3 R4). El delay lo pone cada punto.
        "typing-dot": {
          "0%, 80%, 100%": { opacity: "0.35", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-2px)" },
        },
      },
      animation: {
        "fade-slide-in": "fade-slide-in 0.35s ease-out both",
        float: "float 3.5s ease-in-out infinite",
        "typing-dot": "typing-dot 1.2s ease-in-out infinite",
      },
    },
  },
};

export default config;
