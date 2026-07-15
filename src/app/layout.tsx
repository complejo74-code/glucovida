import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

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
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
