"use client";

import Link from "next/link";
import { useEffect } from "react";
import posthog from "posthog-js";
import { Button, buttonClass } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { cn } from "@/lib/cn";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";
import { userFacingErrorText } from "@/lib/ui/user-facing-error";

export function RouteErrorScreen({
  title,
  error,
  reset,
  homeHref = "/",
  homeLabel = "Strona główna",
  logLabel = "route",
  className,
}: {
  title: string;
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
  logLabel?: string;
  className?: string;
}) {
  useEffect(() => {
    console.error(`[${logLabel}]`, error);
    // Błąd złapany przez error boundary nie dociera do window.onerror — zgłaszamy go sami.
    if (posthog.__loaded) posthog.captureException(error, { boundary: logLabel, digest: error.digest });
  }, [error, logLabel]);

  return (
    <div className={cn(salesPageShellClass, className)}>
      <Alert tone="error" title={title}>
        <p>
          {userFacingErrorText(
            error,
            "Wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć później."
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="min-h-11 sm:min-h-9" onClick={() => reset()}>
            Spróbuj ponownie
          </Button>
          <Link
            href={homeHref}
            className={buttonClass("secondary", "sm", "min-h-11 sm:min-h-9")}
          >
            {homeLabel}
          </Link>
        </div>
      </Alert>
    </div>
  );
}
