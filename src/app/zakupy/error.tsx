"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function ZakupyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać panelu zakupów"
      error={error}
      reset={reset}
      homeHref="/podsumowanie"
      homeLabel="Panel dzienny"
      logLabel="zakupy"
    />
  );
}
