"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function MojeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać Twoich zamówień"
      error={error}
      reset={reset}
      homeHref="/moje"
      homeLabel="Moje zamówienia"
      logLabel="moje"
    />
  );
}
