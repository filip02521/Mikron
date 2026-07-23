"use client";

import { useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

function isMonthlySummaryAvailable(): boolean {
  const now = new Date();
  return now.getDate() <= 7;
}

export function MonthlySummaryNotice() {
  const show = useMemo(() => isMonthlySummaryAvailable(), []);
  if (!show) return null;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("pl-PL", { month: "long", year: "numeric" });

  return (
    <Link
      href="/podsumowanie-miesieczne"
      className={cn(
        "flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5",
        "transition-colors hover:border-violet-300 hover:bg-violet-100"
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-violet-900">
          Dostępne jest podsumowanie za {monthLabel}
        </p>
        <p className="text-xs text-violet-700">
          Statystyki handlowców, dostaw i zakupów — kliknij, aby zobaczyć.
        </p>
      </div>
      <span className="shrink-0 text-violet-600">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
