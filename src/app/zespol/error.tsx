"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function ZespolError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać panelu zespołu"
      error={error}
      reset={reset}
      logLabel="zespol"
    />
  );
}
