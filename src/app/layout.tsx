import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CryptoPolyfillInit } from "@/components/CryptoPolyfillScript";
import { FontScaleScript } from "@/components/layout/FontScaleScript";
import { AppShell } from "@/components/layout/AppShell";
import { defaultAppMetadata } from "@/lib/ui/page-metadata";

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

export const metadata: Metadata = defaultAppMetadata;

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pl"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <FontScaleScript />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <CryptoPolyfillInit />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
