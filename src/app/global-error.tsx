"use client";

import "./globals.css";
import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

/** Błąd w głównym layoucie (AppShell) — zastępuje cały dokument, więc ma własne html/body. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  const err = error instanceof Error ? error : new Error(String(error));
  return (
    <html lang="pl">
      <body className="min-h-screen font-sans antialiased">
        <RouteErrorScreen
          title="Nie udało się wczytać aplikacji"
          error={err}
          reset={retry}
          logLabel="global"
        />
      </body>
    </html>
  );
}
