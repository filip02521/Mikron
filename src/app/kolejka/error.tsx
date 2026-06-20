"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function KolejkaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać kolejki magazynu"
      error={error}
      reset={reset}
      homeHref="/kolejka"
      logLabel="kolejka"
    />
  );
}
