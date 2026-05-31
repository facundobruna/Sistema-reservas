import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import "./globals.css";

const display = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
  display: "swap"
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Mesa Clara",
  description: "Reservas refinadas para restaurantes operativos"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        <a className="skip-link" href="#content">
          Saltar al contenido
        </a>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
