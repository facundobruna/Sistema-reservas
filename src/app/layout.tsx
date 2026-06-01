import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CookieConsent } from "@/components/legal/cookie-consent";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const sans = Geist({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap"
});

const mono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "Mesa Clara",
  description: "Reservas refinadas para restaurantes operativos"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <a className="skip-link" href="#content">
          Saltar al contenido
        </a>
        <QueryProvider>{children}</QueryProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
