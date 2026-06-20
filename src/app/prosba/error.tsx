"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function ProsbaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać formularza prośby"
      error={error}
      reset={reset}
      homeHref="/prosba"
      homeLabel="Prośba"
      logLabel="prosba"
    />
  );
}
