"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function PodsumowanieError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać panelu dziennego"
      error={error}
      reset={reset}
      homeHref="/podsumowanie"
      logLabel="podsumowanie"
    />
  );
}
