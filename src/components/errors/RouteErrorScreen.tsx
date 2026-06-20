"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { SystemNotice } from "@/components/ui/SystemNotice";
import { cn } from "@/lib/cn";
import { salesPageShellClass } from "@/lib/ui/ontime-theme";

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
      <SystemNotice
        variant="pinned"
        role="alert"
        title={title}
        description={
          error.message.trim() ||
          "Wystąpił nieoczekiwany błąd. Spróbuj ponownie lub wróć później."
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => reset()}>
              Spróbuj ponownie
            </Button>
            <Link
              href={homeHref}
              className="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              {homeLabel}
            </Link>
          </div>
        }
      />
    </div>
  );
}
