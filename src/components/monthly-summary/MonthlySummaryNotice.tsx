"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

const DISMISS_KEY = "monthly-summary-dismissed";

function getDismissedMonth(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function setDismissedMonth(monthKey: string) {
  try {
    sessionStorage.setItem(DISMISS_KEY, monthKey);
  } catch {
    /* ignore */
  }
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonthLabel(): string {
  const now = new Date();
  return now.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
}

export function MonthlySummaryNotice() {
  const monthKey = useMemo(() => currentMonthKey(), []);
  const monthLabel = useMemo(() => currentMonthLabel(), []);
  const [dismissed, setDismissed] = useState(false);
  const [mounted] = useState(() => {
    if (typeof window === "undefined") return false;
    const now = new Date();
    if (now.getDate() > 7) return false;
    return getDismissedMonth() !== monthKey;
  });

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDismissedMonth(monthKey);
      setDismissed(true);
    },
    [monthKey]
  );

  if (!mounted || dismissed) return null;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2.5 overflow-hidden",
        "rounded-lg border border-violet-200/50 bg-gradient-to-r from-violet-50/80 via-indigo-50/60 to-transparent",
        "px-3 py-2 shadow-sm transition-all hover:border-violet-300/60",
        "md:mr-12 md:max-w-[calc(100%-3.5rem)]"
      )}
    >
      <Link
        href="/podsumowanie-miesieczne"
        className="flex min-w-0 flex-1 items-center gap-2.5"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 14l4-4 3 3 5-5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-violet-900">
            Podsumowanie za {monthLabel}
          </p>
          <p className="truncate text-[11px] leading-tight text-violet-600/80">
            Statystyki zespołu są gotowe do wglądu
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-violet-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 transition-colors group-hover:bg-violet-200/80">
          Zobacz
        </span>
      </Link>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Zamknij powiadomienie"
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-violet-400",
          "transition-colors hover:bg-violet-100 hover:text-violet-700"
        )}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
