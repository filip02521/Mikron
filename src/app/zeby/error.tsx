"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function ZebyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać panelu zębów"
      error={error}
      reset={reset}
      homeHref="/zeby"
      logLabel="zeby"
    />
  );
}
