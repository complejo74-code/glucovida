import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { SplashScreen } from "@/components/pwa/SplashScreen";

// Nunito: la tipografía de GlucoVida (ver docs/BRANDING.md §5). Variable font,
// self-hosted por next/font — sin <link> suelto, sin request a Google en runtime.
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "GlucoVida",
  description: "Tu espacio de convivencia con la diabetes.",
  // PWA (paso 11). El <link rel="manifest"> lo inyecta Next desde app/manifest.ts.
  applicationName: "GlucoVida",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  // iOS: tratar la app como instalable (Añadir a pantalla de inicio) en pantalla
  // completa. `apple-mobile-web-app-capable` cubre iOS; el resto lo agrega Next.
  appleWebApp: {
    capable: true,
    title: "GlucoVida",
    statusBarStyle: "default",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// El teclado virtual encoge la unidad `dvh` (en vez de solo tapar contenido).
// Sin esto, en /chat el `h-dvh` sobra por debajo del teclado, el documento se
// vuelve scrolleable y el header se va arrastrado. Ver docs de layout de /chat.
// themeColor (paso 11): tiñe la barra de estado con el celeste de marca.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  themeColor: "#22A7E6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <SplashScreen />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
