"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
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
            className="inline-flex min-h-11 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 sm:min-h-9"
          >
            {homeLabel}
          </Link>
        </div>
      </Alert>
    </div>
  );
}
