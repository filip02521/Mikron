"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Wystąpił błąd aplikacji"
      error={error}
      reset={reset}
      logLabel="app"
    />
  );
}
