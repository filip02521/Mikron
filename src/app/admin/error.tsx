"use client";

import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorScreen
      title="Nie udało się wczytać panelu administracji"
      error={error}
      reset={reset}
      homeHref="/admin"
      homeLabel="Panel admin"
      logLabel="admin"
    />
  );
}
