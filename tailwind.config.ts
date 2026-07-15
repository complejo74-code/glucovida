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
          foreground: "#FFFFFF", // texto sobre celeste (para shadcn Button)
        },
        white: "#FFFFFF",
        text: "#0F172A",
        muted: "#5B6B7C",
        border: "#E6EEF5",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },

      // ── Radios (4) ───────────────────────────────────────────────────────
      borderRadius: {
        card: "28px",
        input: "14px", // radio intermedio cómodo para inputs (ni sharp ni pill)
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
        "gradient-primary": "linear-gradient(180deg, #22A7E6, #1D90C7)",
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
    },
  },
};

export default config;
