"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  buttonPrimaryClass,
  controlFocusClass,
} from "@/lib/ui/ontime-theme";

export function NotFoundAttemptedPath() {
  const pathname = usePathname();
  if (!pathname || pathname === "/") return null;

  return (
    <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-left ring-1 ring-inset ring-slate-200/80">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Szukany adres
      </span>
      <code className="mt-0.5 block truncate font-mono text-xs text-slate-600">{pathname}</code>
    </p>
  );
}

/** Wstecz tylko gdy referrer jest z tej samej origin (history.length jest zawodne). */
function sameOriginReferrer(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ref = document.referrer;
    if (!ref) return false;
    return new URL(ref).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function NotFoundActions({
  homeHref,
  homeLabel,
  secondaryHref,
  secondaryLabel,
}: {
  homeHref: string;
  homeLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (sameOriginReferrer()) {
      router.back();
      return;
    }
    router.push(homeHref);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
      <Link
        href={homeHref}
        className={cn(
          buttonPrimaryClass,
          controlFocusClass,
          "inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-sm font-medium"
        )}
      >
        {homeLabel}
      </Link>
      <button
        type="button"
        onClick={handleBack}
        className={cn(
          controlFocusClass,
          "inline-flex min-h-11 items-center justify-center rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        )}
      >
        Wstecz
      </button>
      {secondaryHref && secondaryLabel ? (
        <Link
          href={secondaryHref}
          className={cn(
            controlFocusClass,
            "inline-flex min-h-11 items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50 hover:text-indigo-900 sm:basis-full"
          )}
        >
          {secondaryLabel}
        </Link>
      ) : null}
    </div>
  );
}
