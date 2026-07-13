"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function UrlopyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać urlopów"
      error={error}
      reset={reset}
      homeHref="/urlopy"
      logLabel="urlopy"
    />
  );
}
