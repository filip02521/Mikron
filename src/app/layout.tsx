import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CryptoPolyfillScript } from "@/components/CryptoPolyfillScript";
import { AppShell } from "@/components/layout/AppShell";
import {
  ONTIME_APP_DESCRIPTION,
  ONTIME_APP_NAME,
} from "@/lib/ui/ontime-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: ONTIME_APP_NAME,
    template: `%s · ${ONTIME_APP_NAME}`,
  },
  description: ONTIME_APP_DESCRIPTION,
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl" className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <CryptoPolyfillScript />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
