"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RouteErrorScreen } from "@/components/errors/RouteErrorScreen";
import { isServerActionTransportError } from "@/lib/client/server-action-transport-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    if (isServerActionTransportError(error)) {
      const t = setTimeout(() => {
        reset();
        router.refresh();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [error, reset, router]);

  if (isServerActionTransportError(error)) return null;

  return (
    <RouteErrorScreen
      title="Wystąpił błąd aplikacji"
      error={error}
      reset={reset}
      logLabel="app"
    />
  );
}
