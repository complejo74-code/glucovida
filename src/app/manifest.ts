import type { MetadataRoute } from "next";

/**
 * Manifest PWA de GlucoVida (paso 11). Next lo sirve en /manifest.webmanifest
 * e inyecta el <link rel="manifest"> automáticamente.
 *
 * Colores de marca (docs/BRANDING.md §3): theme = celeste primary #22A7E6;
 * background = blanco (el gradiente de marca SIEMPRE degrada hacia blanco).
 * start_url = /chat: la ruta raíz "/" ya redirige a /chat o /login según sesión
 * (src/app/page.tsx), así que al abrir la app instalada caemos en el lugar
 * correcto sin romper auth.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GlucoVida",
    short_name: "GlucoVida",
    description: "Tu espacio de convivencia con la diabetes.",
    start_url: "/chat",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#22A7E6",
    background_color: "#FFFFFF",
    lang: "es",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
