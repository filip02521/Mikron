"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function MonthlySummaryError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać podsumowania miesiąca"
      error={error}
      reset={reset}
      homeHref="/podsumowanie-miesieczne"
      logLabel="podsumowanie-miesieczne"
    />
  );
}
