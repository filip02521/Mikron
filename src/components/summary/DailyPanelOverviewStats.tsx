"use client";

import Link from "next/link";
import type { DailyInboxSummary } from "@/lib/orders/procurement-daily-ui";
import { cn } from "@/lib/cn";

function unitLabel(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function DailyPanelOverviewStats({
  summary,
  verificationCount = 0,
  showVerification = true,
}: {
  summary: DailyInboxSummary;
  verificationCount?: number;
  /** Ukryj wiersz weryfikacji, gdy baner w zakładce Dziś już informuje. */
  showVerification?: boolean;
}) {
  const queueTotal =
    summary.overdueCount + summary.todayCount + summary.forSomeoneGroupCount;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <Stat value={summary.overdueCount} label={unitLabel(summary.overdueCount, "zaległe", "zaległe", "zaległych")} />
        <Divider />
        <Stat
          value={summary.forSomeoneGroupCount}
          label={unitLabel(summary.forSomeoneGroupCount, "grupa prośb", "grupy prośb", "grup prośb")}
        />
        <Divider />
        <Stat
          value={summary.todayCount}
          label={unitLabel(summary.todayCount, "na dziś", "na dziś", "na dziś")}
        />
        <Divider />
        <Stat
          value={queueTotal}
          label="w kolejce Dziś"
          emphasize
        />
      </div>
      {showVerification && verificationCount > 0 ? (
        <Link
          href="/weryfikacja"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-950 hover:bg-amber-200/90"
        >
          <span className="tabular-nums">{verificationCount}</span>
          do uzupełnienia
        </Link>
      ) : null}
    </div>
  );
}

function Stat({
  value,
  label,
  emphasize,
}: {
  value: number;
  label: string;
  emphasize?: boolean;
}) {
  return (
    <div className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "tabular-nums",
          emphasize ? "text-base font-semibold text-indigo-900" : "text-base font-semibold text-slate-900"
        )}
      >
        {value}
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="hidden h-3.5 w-px bg-slate-200 sm:block" aria-hidden />;
}
