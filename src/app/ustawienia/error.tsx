"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function UstawieniaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać ustawień"
      error={error}
      reset={reset}
      homeHref="/ustawienia"
      logLabel="ustawienia"
    />
  );
}
