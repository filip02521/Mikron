"use client";

import Link from "next/link";
import { useMemo } from "react";
import { cn } from "@/lib/cn";
import {
  formatAutomatDay,
  warsawKeyFromIso,
  zdAutomatNightPassed,
  zdAutomatNightRunState,
  zdAutomatSupplierView,
  type ZdAutomatDailyData,
} from "@/lib/orders/zd-automat-daily";
import { panelSubsectionInsetClass } from "@/lib/ui/ontime-theme";

/**
 * Panel dzienny → „Dziś”: linia stanu automatu ZD — tylko gdy coś nie gra (brak nocnego przebiegu, błąd,
 * automat stoi u dostawcy). Zamówienia automatu są wierszami listy „Dostawcy na dziś”, a stan i ustawienia
 * każdego dostawcy — na pulpicie automatu.
 */
export function DailyZdAutomatSection({
  data,
  nowIso,
}: {
  data: ZdAutomatDailyData;
  /** Czas z serwera — ten sam wynik przy renderze na serwerze i w przeglądarce. */
  nowIso: string;
}) {
  const { todayKey, nowMinutes } = useMemo(() => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(nowIso));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    return { todayKey: warsawKeyFromIso(nowIso), nowMinutes: h * 60 + m };
  }, [nowIso]);

  if (!data.suppliers.length) return null;
  const night = zdAutomatNightRunState(data.run, todayKey, nowMinutes);
  const nightPassed = zdAutomatNightPassed(night);
  const stoppedCount = data.suppliers.filter((s) => {
    const view = zdAutomatSupplierView(s, { todayKey, nightPassed });
    return view.stopReason || view.attemptProblem;
  }).length;
  const nightProblem =
    night.kind === "missing"
      ? `dziś bez nocnego przebiegu${night.lastRunDate ? ` (ostatni ${formatAutomatDay(night.lastRunDate, todayKey)})` : ""}`
      : night.kind === "done" && night.failed
        ? "nocny przebieg z błędem"
        : null;
  const problems = [
    nightProblem,
    stoppedCount ? `automat stoi u ${stoppedCount} ${stoppedCount === 1 ? "dostawcy" : "dostawców"}` : null,
  ].filter(Boolean);
  if (!problems.length) return null;

  return (
    <section
      aria-label="Stan automatu ZD"
      className={cn(
        "flex flex-col gap-1.5 rounded-[var(--radius-panel)] border border-amber-200 bg-amber-50 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        panelSubsectionInsetClass
      )}
    >
      <p role="status" className="min-w-0 text-sm leading-snug text-amber-900">
        <span className="font-semibold text-amber-950">Automat ZD:</span> {problems.join(" · ")}
      </p>
      <Link
        href="/zakupy/automat"
        className="inline-flex min-h-11 shrink-0 items-center self-end rounded-md px-2 text-sm font-medium text-amber-950 underline underline-offset-2 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:min-h-8 sm:self-auto"
      >
        Pulpit automatu
      </Link>
    </section>
  );
}
