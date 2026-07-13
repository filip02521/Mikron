"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function ZamowieniaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać zamówień"
      error={error}
      reset={reset}
      homeHref="/zamowienia"
      logLabel="zamowienia"
    />
  );
}
