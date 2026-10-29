import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import "./globals.css";
import { CryptoPolyfillInit } from "@/components/CryptoPolyfillScript";
import { FontScaleScript } from "@/components/layout/FontScaleScript";
import { SidebarCollapseScript } from "@/components/layout/SidebarCollapseScript";
import { ThemeScript } from "@/components/layout/ThemeScript";
import { THEME_COLOR } from "@/lib/auth/theme";
import { AppShell } from "@/components/layout/AppShell";
import { defaultAppMetadata } from "@/lib/ui/page-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});
// Tytuły strony i sekcji (DESIGN.md → Typography, Display).
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin", "latin-ext"],
  weight: ["700"],
  display: "swap",
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = defaultAppMetadata;

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
  // ThemeSync nadpisuje oba wpisy kolorem motywu z konta.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR.light },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} ${interTight.variable}`}
      // Skrypty w <head> ustawiają data-theme / data-font-scale / data-sidebar przed hydracją (bez mignięcia).
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
        <FontScaleScript />
        <SidebarCollapseScript />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <CryptoPolyfillInit />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
