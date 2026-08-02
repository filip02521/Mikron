"use client";

import {
  useMemo,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import {
  controlFocusClass,
  buttonPrimaryClass,
  brandGradientTextClass,
  panelStickyChromeClass,
  surfaceCardClass,
} from "@/lib/ui/ontime-theme";
import type {
  MonthlyStats,
  MonthlySummaryTab,
  SalesRankingSort,
} from "@/lib/data/monthly-stats-shared";
import {
  MONTHLY_STATS_ACTION_AT_HINT,
  allocatePercentageShares,
  isCompletedMonthlySummaryMonth,
  nextMonthKeyFromMonthKey,
  previousMonthKeyFromMonthKey,
  salesPersonSuccessRate,
  salesTotalsFromStats,
  sortSalesRanking,
} from "@/lib/data/monthly-stats-shared";
import {
  defaultMonthlySummaryTabForRole,
  isMonthlySummaryTab,
} from "@/lib/data/monthly-summary-defaults";
import {
  formatDni,
  formatPaczki,
  formatPalety,
  formatZamknieteZk,
  formatZlozoneProsby,
  formatZrealizowaneProsby,
  unitPaczki,
  unitPalety,
  unitProsby,
  unitPrzyjecia,
  unitZamowienia,
} from "@/lib/data/monthly-summary-pl";
import { warehouseCarrierLabel } from "@/lib/warehouse/delivery-carriers";
import { useMarkMonthlySummarySeenOnVisit } from "@/hooks/useMonthlySummaryAttention";
import type { UserRole, Workspace } from "@/types/database";
import {
  KpiCard,
  SecondaryStat,
  SectionHeading,
  ShareBar,
} from "@/components/monthly-summary/monthly-summary-parts";

const TAB_META: Record<
  MonthlySummaryTab,
  { label: string; hint: string; icon: string; accent: string; accentSoft: string; accentRing: string }
> = {
  handlowcy: {
    label: "Handlowcy",
    hint: "Prośby i dokumenty ZK",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
    accent: "text-indigo-600",
    accentSoft: "bg-indigo-50",
    accentRing: "ring-indigo-200",
  },
  dostawy: {
    label: "Dostawy",
    hint: "Przyjęcia, paczki i palety",
    icon: "M3 7h11v10H3zM14 10h4l3 3v4h-7",
    accent: "text-emerald-600",
    accentSoft: "bg-emerald-50",
    accentRing: "ring-emerald-200",
  },
  zakupy: {
    label: "Zakupy",
    hint: "Zamówienia i ranking dostawców",
    icon: "M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6",
    accent: "text-amber-600",
    accentSoft: "bg-amber-50",
    accentRing: "ring-amber-200",
  },
  zeby: {
    label: "Zęby",
    hint: "Tor zębów — prośby i dostawcy",
    icon: "M12 3c2.5 2 4 4.5 4 7.5S14 17 12 21c-2-4-4-7-4-10.5S9.5 5 12 3z",
    accent: "text-violet-600",
    accentSoft: "bg-violet-50",
    accentRing: "ring-violet-200",
  },
};

const TAB_ORDER: MonthlySummaryTab[] = ["handlowcy", "dostawy", "zakupy", "zeby"];

const SORT_OPTIONS: { value: SalesRankingSort; label: string }[] = [
  { value: "requests", label: "Złożone prośby" },
  { value: "successRate", label: "Skuteczność" },
  { value: "zkClosed", label: "ZK zamknięte" },
];

const MOTIVATIONAL_QUOTES = [
  "Dobra organizacja to połowa sukcesu — a statystyki to jej zwierciadło.",
  "Każde zamówienie to historia zaufania. Liczby mówią, jak dobrze ją opowiadamy.",
  "Czas to waluta. Każdy dzień realizacji to inwestycja w relację z klientem.",
  "Najlepszy miesiąc to nie ten bez błędów — to ten, z którego najwięcej się uczymy.",
  "Pomiar jest początkiem wiedzy. To, co mierzymy, rośnie.",
];

const MEDAL_META = [
  { bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300/60", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" },
  { bg: "bg-slate-200", text: "text-slate-600", ring: "ring-slate-400/50", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" },
  { bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300/60", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" },
];

function tabPreview(stats: MonthlyStats, tab: MonthlySummaryTab): { value: string; unit: string } {
  if (tab === "handlowcy") {
    const n = salesTotalsFromStats(stats.sales).requestsCreated;
    return { value: String(n), unit: unitProsby(n) };
  }
  if (tab === "dostawy") {
    const n = stats.delivery.totalReceipts;
    return { value: String(n), unit: unitPrzyjecia(n) };
  }
  if (tab === "zeby") {
    const n = stats.teeth.requestsCreated;
    return { value: String(n), unit: unitProsby(n) };
  }
  const n = stats.procurement.totalOrders;
  return { value: String(n), unit: unitZamowienia(n) };
}

function syncTabInUrl(tab: MonthlySummaryTab) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  const qs = url.searchParams.toString();
  window.history.replaceState(window.history.state, "", `${url.pathname}${qs ? `?${qs}` : ""}`);
}

function EmptyMonthCta({
  availableMonths,
  currentKey,
  onSelect,
}: {
  availableMonths: { key: string; label: string }[];
  currentKey: string;
  onSelect: (key: string) => void;
}) {
  const other =
    availableMonths.find((m) => m.key !== currentKey) ??
    availableMonths.find((m) => m.key === previousMonthKeyFromMonthKey(currentKey));
  if (!other) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200/80">
      <p className="text-sm text-slate-600">Ten miesiąc jest pusty w tym widoku.</p>
      <button
        type="button"
        onClick={() => onSelect(other.key)}
        className={cn(buttonPrimaryClass, "rounded-lg px-3 py-1.5 text-sm font-medium", controlFocusClass)}
      >
        Zobacz {other.label}
      </button>
    </div>
  );
}

function MonthSelector({
  availableMonths,
  currentKey,
  onSelect,
  disabled,
}: {
  availableMonths: { key: string; label: string }[];
  currentKey: string;
  onSelect: (key: string) => void;
  disabled?: boolean;
}) {
  const keys = availableMonths.map((m) => m.key);
  const idx = keys.indexOf(currentKey);
  const prevKey =
    idx >= 0 ? keys[idx + 1] : previousMonthKeyFromMonthKey(currentKey);
  const nextCandidate =
    idx > 0 ? keys[idx - 1] : nextMonthKeyFromMonthKey(currentKey);
  const canPrev = Boolean(prevKey && keys.includes(prevKey));
  const canNext =
    Boolean(nextCandidate && keys.includes(nextCandidate)) &&
    isCompletedMonthlySummaryMonth(nextCandidate);

  const currentLabel =
    availableMonths.find((m) => m.key === currentKey)?.label ?? currentKey;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Miesiąc
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled || !canPrev}
          onClick={() => prevKey && onSelect(prevKey)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors",
            controlFocusClass,
            "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          )}
          aria-label="Poprzedni miesiąc"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <label className="sr-only" htmlFor="monthly-summary-month">
          Wybierz miesiąc
        </label>
        <select
          id="monthly-summary-month"
          value={currentKey}
          disabled={disabled}
          onChange={(e) => onSelect(e.target.value)}
          className={cn(
            "h-9 max-w-[11rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-800",
            controlFocusClass,
            "disabled:cursor-not-allowed disabled:opacity-60"
          )}
          aria-label={`Wybrany miesiąc: ${currentLabel}`}
        >
          {availableMonths.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
          {!keys.includes(currentKey) ? (
            <option value={currentKey}>{currentLabel}</option>
          ) : null}
        </select>
        <button
          type="button"
          disabled={disabled || !canNext || !nextCandidate}
          onClick={() => nextCandidate && onSelect(nextCandidate)}
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors",
            controlFocusClass,
            "hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          )}
          aria-label="Następny miesiąc"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StickyDepartmentTabs({
  active,
  onChange,
  stats,
}: {
  active: MonthlySummaryTab;
  onChange: (tab: MonthlySummaryTab) => void;
  stats: MonthlyStats;
}) {
  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = TAB_ORDER.indexOf(active);
    if (idx < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(TAB_ORDER[(idx + 1) % TAB_ORDER.length]!);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]!);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(TAB_ORDER[0]!);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(TAB_ORDER[TAB_ORDER.length - 1]!);
    }
  }

  return (
    <div className="px-5 py-3">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        Działy · {stats.monthLabel}
      </p>
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="tablist"
        aria-label="Działy podsumowania"
        onKeyDown={handleKeyDown}
      >
        {TAB_ORDER.map((tab) => {
          const isActive = active === tab;
          const meta = TAB_META[tab];
          const preview = tabPreview(stats, tab);
          return (
            <button
              key={tab}
              type="button"
              role="tab"
              id={`monthly-tab-${tab}`}
              aria-selected={isActive}
              aria-controls={`monthly-panel-${tab}`}
              tabIndex={isActive ? 0 : -1}
              title={meta.hint}
              onClick={() => onChange(tab)}
              className={cn(
                "group flex flex-col items-stretch gap-1 rounded-lg px-2.5 py-2 text-left transition-all sm:flex-row sm:items-center sm:gap-2",
                controlFocusClass,
                isActive
                  ? cn("bg-white shadow-sm ring-2", meta.accentRing, "ring-offset-1")
                  : "bg-slate-50/90 ring-1 ring-inset ring-slate-200/80 hover:bg-white hover:ring-slate-300 hover:shadow-sm"
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive ? meta.accentSoft : "bg-white ring-1 ring-slate-200/80",
                  isActive ? meta.accent : "text-slate-400 group-hover:text-slate-600"
                )}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={meta.icon} />
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-xs font-semibold sm:text-sm",
                    isActive ? "text-slate-900" : "text-slate-700"
                  )}
                >
                  {meta.label}
                </span>
                <span className="hidden text-[10px] text-slate-500 lg:block">{meta.hint}</span>
              </span>
              <span
                className={cn(
                  "text-sm font-bold tabular-nums",
                  isActive ? meta.accent : "text-slate-700"
                )}
              >
                {preview.value}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HighlightCard({
  eyebrow,
  title,
  children,
  gradientClass,
  ringClass,
  iconBgClass,
  iconPath,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  gradientClass: string;
  ringClass: string;
  iconBgClass: string;
  iconPath: string;
}) {
  return (
    <div className={cn("relative rounded-xl p-5 ring-1 ring-inset", gradientClass, ringClass)}>
      <div className="relative flex items-center gap-4">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-md",
            iconBgClass
          )}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={iconPath} />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600/80">{eyebrow}</p>
          <p className="mt-0.5 truncate text-lg font-bold text-slate-900">{title}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">{children}</div>
        </div>
      </div>
    </div>
  );
}

function MetricSourceHint() {
  return (
    <p className="mt-2 text-[11px] leading-snug text-slate-400">{MONTHLY_STATS_ACTION_AT_HINT}</p>
  );
}

function SalesTab({
  stats,
  onMonthSelect,
}: {
  stats: MonthlyStats;
  onMonthSelect: (key: string) => void;
}) {
  const { sales, mom } = stats;
  const [sort, setSort] = useState<SalesRankingSort>("requests");
  const ranked = useMemo(() => sortSalesRanking(sales, sort), [sales, sort]);
  const totals = salesTotalsFromStats(sales);
  const top = ranked[0];
  const maxRequests = Math.max(...ranked.map((s) => s.requestsCreated), 1);
  const shares = allocatePercentageShares(ranked.map((s) => s.requestsCreated));
  const hasActivity = sales.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kluczowe wskaźniki
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Złożone prośby"
            value={totals.requestsCreated}
            tone="indigo"
            mom={mom.sales.requestsCreated}
            previousLabel={mom.previousMonthLabel}
          />
          <KpiCard
            label="Zrealizowane prośby"
            value={totals.requestsCompleted}
            tone="emerald"
            progress={totals.successRate}
            mom={mom.sales.requestsCompleted}
            previousLabel={mom.previousMonthLabel}
            hint={
              totals.requestsCreated > 0
                ? `${totals.successRate}% wszystkich złożonych`
                : undefined
            }
          />
          <KpiCard
            label="Wskaźnik skuteczności"
            value={`${totals.successRate}%`}
            tone="slate"
            progress={totals.successRate}
            mom={mom.sales.successRate}
            previousLabel={mom.previousMonthLabel}
            momUnit="pp"
          />
          <KpiCard
            label="Zamknięte dokumenty ZK"
            value={totals.zkClosed}
            tone="violet"
            mom={mom.sales.zkClosed}
            previousLabel={mom.previousMonthLabel}
          />
        </div>
        <MetricSourceHint />
      </div>

      {!hasActivity ? (
        <>
          <Alert tone="info">Brak aktywności handlowców w tym miesiącu (bez toru zębów).</Alert>
          <EmptyMonthCta
            availableMonths={stats.availableMonths}
            currentKey={stats.monthKey}
            onSelect={onMonthSelect}
          />
        </>
      ) : null}

      {top ? (
        <HighlightCard
          eyebrow="Lider miesiąca"
          title={top.salesPersonName}
          gradientClass="bg-gradient-to-br from-indigo-50 to-violet-50"
          ringClass="ring-indigo-200/60"
          iconBgClass="bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20"
          iconPath="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"
        >
          <span>{formatZlozoneProsby(top.requestsCreated)}</span>
          <span className="text-emerald-700">{formatZrealizowaneProsby(top.requestsCompleted)}</span>
          <span className="text-violet-700">{formatZamknieteZk(top.zkClosed)}</span>
        </HighlightCard>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Szczegóły
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SecondaryStat label="Anulowane prośby" value={totals.requestsCancelled} tone="amber" />
          <SecondaryStat
            label="ZK otwarte na koniec miesiąca"
            value={totals.zkOpen}
            tone="sky"
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-400">
          Otwarte ZK = dokumenty utworzone przed końcem miesiąca, które wtedy jeszcze nie były
          zamknięte ani zarchiwizowane (backlog).
        </p>
      </div>

      {hasActivity ? (
        <div className={surfaceCardClass}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <SectionHeading
              title="Ranking handlowców"
              icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              iconClassName="text-indigo-600"
              bare
            />
            <label className="flex items-center gap-2 text-xs text-slate-500">
              Sortuj wg
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SalesRankingSort)}
                className={cn(
                  "rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700",
                  controlFocusClass
                )}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="divide-y divide-slate-50 md:hidden">
            {ranked.map((s, idx) => {
              const medal = idx < 3 ? MEDAL_META[idx] : null;
              const rate = salesPersonSuccessRate(s);
              const share = shares[idx] ?? 0;
              return (
                <div key={s.salesPersonId} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {medal ? (
                      <span
                        className={cn(
                          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1",
                          medal.bg,
                          medal.text,
                          medal.ring
                        )}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={medal.icon} />
                        </svg>
                      </span>
                    ) : (
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center text-xs font-semibold tabular-nums text-slate-400">
                        {idx + 1}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">{s.salesPersonName}</p>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                          {s.requestsCreated}
                        </span>
                      </div>
                      <ShareBar
                        sharePct={share}
                        barClassName="bg-gradient-to-r from-indigo-400 to-violet-500"
                        showLabel={false}
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {share}% wszystkich próśb
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="tabular-nums text-emerald-700">{s.requestsCompleted}</span>
                        {" "}
                        zrealizowanych
                        <span className="mx-1.5 text-slate-300">·</span>
                        {rate}% skuteczności
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                        <span>
                          <strong className="tabular-nums text-amber-700">{s.requestsCancelled}</strong>
                          {" "}
                          anulowanych
                        </span>
                        <span>
                          <strong className="tabular-nums text-violet-700">{s.zkClosed}</strong>
                          {" "}
                          ZK zamkniętych
                        </span>
                        <span>
                          <strong className="tabular-nums text-sky-700">{s.zkOpen}</strong>
                          {" "}
                          ZK otwartych EOM
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Miejsce</th>
                  <th className="px-4 py-2.5 font-medium">Handlowiec</th>
                  <th className="px-4 py-2.5 text-right font-medium">Złożone</th>
                  <th className="px-4 py-2.5 text-right font-medium">Udział</th>
                  <th className="px-4 py-2.5 text-right font-medium">Zrealizowane</th>
                  <th className="px-4 py-2.5 text-right font-medium">Anulowane</th>
                  <th className="px-4 py-2.5 text-right font-medium">ZK zamknięte</th>
                  <th className="px-4 py-2.5 text-right font-medium">ZK EOM</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((s, idx) => {
                  const medal = idx < 3 ? MEDAL_META[idx] : null;
                  const rate = salesPersonSuccessRate(s);
                  const share = shares[idx] ?? 0;
                  const barVsLeader = Math.round((s.requestsCreated / maxRequests) * 100);
                  return (
                    <tr
                      key={s.salesPersonId}
                      className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        {medal ? (
                          <span
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-full ring-1",
                              medal.bg,
                              medal.text,
                              medal.ring
                            )}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d={medal.icon} />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center text-xs font-semibold tabular-nums text-slate-400">
                            {idx + 1}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{s.salesPersonName}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-1.5 w-20 rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-indigo-400"
                              style={{ width: `${barVsLeader}%` }}
                            />
                          </div>
                          <span className="text-[10px] tabular-nums text-slate-500">
                            {rate}% skuteczności
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-700">
                        {s.requestsCreated}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-slate-500">{share}%</td>
                      <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                        {s.requestsCompleted}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-amber-700">
                        {s.requestsCancelled}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-violet-700">{s.zkClosed}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-sky-700">{s.zkOpen}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeliveryTab({
  stats,
  onMonthSelect,
}: {
  stats: MonthlyStats;
  onMonthSelect: (key: string) => void;
}) {
  const { delivery, mom } = stats;
  const topCarrier = delivery.byCarrier[0];
  const hasReceipts = delivery.totalReceipts > 0;
  const carrierShares = allocatePercentageShares(delivery.byCarrier.map((c) => c.count));
  const formShares = allocatePercentageShares(delivery.byShipmentForm.map((f) => f.count));

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kluczowe wskaźniki
        </p>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <KpiCard
            label="Przyjęcia towaru"
            value={delivery.totalReceipts}
            tone="emerald"
            mom={mom.delivery.totalReceipts}
            previousLabel={mom.previousMonthLabel}
          />
          <KpiCard
            label="Paczki łącznie"
            value={delivery.totalPackages}
            tone="sky"
            mom={mom.delivery.totalPackages}
            previousLabel={mom.previousMonthLabel}
          />
          <KpiCard
            label="Palety łącznie"
            value={delivery.totalPallets}
            tone="amber"
            mom={mom.delivery.totalPallets}
            previousLabel={mom.previousMonthLabel}
          />
        </div>
      </div>

      {!hasReceipts ? (
        <>
          <Alert tone="info">Brak przyjęć towaru w tym miesiącu.</Alert>
          <EmptyMonthCta
            availableMonths={stats.availableMonths}
            currentKey={stats.monthKey}
            onSelect={onMonthSelect}
          />
        </>
      ) : null}

      {topCarrier ? (
        <HighlightCard
          eyebrow="Kurier z największą liczbą przyjęć"
          title={warehouseCarrierLabel(topCarrier.carrier)}
          gradientClass="bg-gradient-to-br from-emerald-50 to-sky-50"
          ringClass="ring-emerald-200/60"
          iconBgClass="bg-gradient-to-br from-emerald-500 to-sky-600 shadow-emerald-500/20"
          iconPath="M3 7h11v10H3zM14 10h4l3 3v4h-7"
        >
          <span>
            <strong className="tabular-nums text-slate-900">{topCarrier.count}</strong>
            {" "}
            {unitPrzyjecia(topCarrier.count)}
          </span>
          <span>
            <strong className="tabular-nums text-sky-700">{topCarrier.packages}</strong>
            {" "}
            {unitPaczki(topCarrier.packages)}
          </span>
          <span>
            <strong className="tabular-nums text-amber-700">{topCarrier.pallets}</strong>
            {" "}
            {unitPalety(topCarrier.pallets)}
          </span>
          <span className="text-slate-500">
            {carrierShares[0] ?? 0}% wszystkich przyjęć
          </span>
        </HighlightCard>
      ) : null}

      {delivery.byShipmentForm.length > 0 ? (
        <div className={surfaceCardClass}>
          <SectionHeading
            title="Forma dostawy"
            icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"
            iconClassName="text-sky-600"
          />
          <div className="divide-y divide-slate-50">
            {delivery.byShipmentForm.map((f, idx) => {
              const share = formShares[idx] ?? 0;
              return (
                <div key={f.form} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">{f.label}</p>
                    <span className="text-sm font-bold tabular-nums text-slate-900">{f.count}</span>
                  </div>
                  <ShareBar
                    sharePct={share}
                    barClassName="bg-gradient-to-r from-sky-400 to-emerald-500"
                    showLabel={false}
                  />
                  <p className="mt-1 text-[11px] text-slate-500">{share}% przyjęć</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {delivery.byCarrier.length > 0 ? (
        <div className={surfaceCardClass}>
          <SectionHeading
            title="Przyjęcia według kuriera"
            icon="M3 7h11v10H3zM14 10h4l3 3v4h-7"
            iconClassName="text-emerald-600"
          />
          <div className="divide-y divide-slate-50">
            {delivery.byCarrier.map((c, idx) => {
              const share = carrierShares[idx] ?? 0;
              return (
                <div
                  key={c.carrier}
                  className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {warehouseCarrierLabel(c.carrier)}
                      </p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                        {c.count}
                      </span>
                    </div>
                    <ShareBar
                      sharePct={share}
                      barClassName="bg-gradient-to-r from-emerald-400 to-sky-500"
                      showLabel={false}
                    />
                    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                      <span>{share}% wszystkich przyjęć</span>
                      <span>{formatPaczki(c.packages)}</span>
                      <span>{formatPalety(c.pallets)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SupplierRanking({
  suppliers,
  title,
  iconClassName,
}: {
  suppliers: MonthlyStats["procurement"]["bySupplier"];
  title: string;
  iconClassName: string;
}) {
  const shares = allocatePercentageShares(suppliers.map((s) => s.orders));
  if (suppliers.length === 0) return null;
  return (
    <div className={surfaceCardClass}>
      <SectionHeading
        title={title}
        icon="M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6"
        iconClassName={iconClassName}
      />
      <div className="divide-y divide-slate-50">
        {suppliers.map((s, idx) => {
          const share = shares[idx] ?? 0;
          const completionRate =
            s.orders > 0 ? Math.round((s.completed / s.orders) * 100) : 0;
          const remainder = Boolean(s.isRemainder);
          return (
            <div
              key={s.supplierId}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50",
                remainder && "bg-slate-50/60"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                  remainder
                    ? "text-slate-400"
                    : idx === 0
                      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300/60"
                      : idx === 1
                        ? "bg-slate-200 text-slate-600 ring-1 ring-slate-400/50"
                        : idx === 2
                          ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300/60"
                          : "text-slate-400"
                )}
              >
                {remainder ? "…" : idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      remainder ? "italic text-slate-600" : "text-slate-800"
                    )}
                  >
                    {s.supplierName}
                  </p>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">
                    {s.orders}
                  </span>
                </div>
                <ShareBar
                  sharePct={share}
                  barClassName="bg-gradient-to-r from-amber-400 to-indigo-500"
                  showLabel={false}
                />
                <div className="mt-1 text-[11px] text-slate-500">
                  {share}% wszystkich zamówień
                  <span className="mx-1.5 text-slate-300">·</span>
                  <strong className="tabular-nums text-emerald-700">{s.completed}</strong>
                  {" "}
                  zrealizowanych
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="tabular-nums">{completionRate}% skuteczności</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {suppliers.some((s) => s.isRemainder) ? (
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          Top 15 dostawców; pozostali są zsumowani w wierszu zbiorczym.
        </p>
      ) : null}
    </div>
  );
}

function ProcurementTab({
  stats,
  onMonthSelect,
}: {
  stats: MonthlyStats;
  onMonthSelect: (key: string) => void;
}) {
  const { procurement, mom } = stats;
  const successRate =
    procurement.totalOrders > 0
      ? Math.round((procurement.completedOrders / procurement.totalOrders) * 100)
      : 0;
  const topSupplier = procurement.bySupplier.find((s) => !s.isRemainder);
  const hasActivity = procurement.totalOrders > 0 || procurement.informacjaCount > 0;
  const sampleHint =
    procurement.avgDeliveryDays != null && procurement.avgDeliverySampleSize > 0
      ? `Na podstawie ${procurement.avgDeliverySampleSize} z ${procurement.completedOrders} zrealizowanych`
      : "Od złożenia zamówienia do dostawy";

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kluczowe wskaźniki
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Zamówienia u dostawców"
            value={procurement.totalOrders}
            tone="indigo"
            mom={mom.procurement.totalOrders}
            previousLabel={mom.previousMonthLabel}
          />
          <KpiCard
            label="Zrealizowane zamówienia"
            value={procurement.completedOrders}
            tone="emerald"
            progress={successRate}
            mom={mom.procurement.completedOrders}
            previousLabel={mom.previousMonthLabel}
            hint={
              procurement.totalOrders > 0
                ? `${successRate}% wszystkich zamówień`
                : undefined
            }
          />
          <KpiCard
            label="Wskaźnik skuteczności"
            value={`${successRate}%`}
            tone="slate"
            progress={successRate}
            mom={mom.procurement.successRate}
            previousLabel={mom.previousMonthLabel}
            momUnit="pp"
          />
          <KpiCard
            label="Średni czas realizacji"
            value={
              procurement.avgDeliveryDays != null
                ? formatDni(procurement.avgDeliveryDays)
                : "brak danych"
            }
            tone="violet"
            mom={mom.procurement.avgDeliveryDays ?? undefined}
            previousLabel={mom.previousMonthLabel}
            momUnit="dni"
            momInvert
            hint={sampleHint}
          />
        </div>
        <MetricSourceHint />
      </div>

      {!hasActivity ? (
        <>
          <Alert tone="info">Brak zamówień w tym miesiącu (bez toru zębów).</Alert>
          <EmptyMonthCta
            availableMonths={stats.availableMonths}
            currentKey={stats.monthKey}
            onSelect={onMonthSelect}
          />
        </>
      ) : null}

      {topSupplier ? (
        <HighlightCard
          eyebrow="Najbardziej aktywny dostawca"
          title={topSupplier.supplierName}
          gradientClass="bg-gradient-to-br from-amber-50 to-indigo-50"
          ringClass="ring-amber-200/60"
          iconBgClass="bg-gradient-to-br from-amber-500 to-indigo-600 shadow-amber-500/20"
          iconPath="M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6"
        >
          <span>
            <strong className="tabular-nums text-slate-900">{topSupplier.orders}</strong>
            {" "}
            {unitZamowienia(topSupplier.orders)}
          </span>
          <span>
            <strong className="tabular-nums text-emerald-700">{topSupplier.completed}</strong>
            {" "}
            zrealizowanych
          </span>
        </HighlightCard>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Szczegóły
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SecondaryStat label="Zamówienia główne" value={procurement.mainOrders} tone="emerald" />
          <SecondaryStat label="Zamówienia poboczne" value={procurement.sideOrders} tone="sky" />
          <SecondaryStat
            label="Zlecenia informacyjne"
            value={procurement.informacjaCount}
            tone="slate"
          />
          <SecondaryStat
            label="Anulowane zamówienia"
            value={procurement.cancelledOrders}
            tone="amber"
          />
        </div>
      </div>

      <SupplierRanking
        suppliers={procurement.bySupplier}
        title="Ranking dostawców"
        iconClassName="text-amber-600"
      />
    </div>
  );
}

function TeethTab({
  stats,
  onMonthSelect,
}: {
  stats: MonthlyStats;
  onMonthSelect: (key: string) => void;
}) {
  const { teeth, mom } = stats;
  const successRate =
    teeth.requestsCreated > 0
      ? Math.round((teeth.completed / teeth.requestsCreated) * 100)
      : 0;
  const topSupplier = teeth.bySupplier.find((s) => !s.isRemainder);
  const hasActivity =
    teeth.requestsCreated > 0 || teeth.ordered > 0 || teeth.completed > 0;
  const leadHint =
    teeth.avgLeadDays != null && teeth.avgLeadSampleSize > 0
      ? `Na podstawie ${teeth.avgLeadSampleSize} z ${teeth.completed} zrealizowanych`
      : "Od zamówienia u dostawcy do dostawy";

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Kluczowe wskaźniki
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Prośby zębów"
            value={teeth.requestsCreated}
            tone="violet"
            mom={mom.teeth.requestsCreated}
            previousLabel={mom.previousMonthLabel}
          />
          <KpiCard
            label="Zamówione u dostawcy"
            value={teeth.ordered}
            tone="indigo"
            mom={mom.teeth.ordered}
            previousLabel={mom.previousMonthLabel}
            hint="Wg daty zamówienia zębów w systemie"
          />
          <KpiCard
            label="Zrealizowane"
            value={teeth.completed}
            tone="emerald"
            progress={successRate}
            mom={mom.teeth.completed}
            previousLabel={mom.previousMonthLabel}
            hint={
              teeth.requestsCreated > 0 ? `${successRate}% złożonych próśb` : undefined
            }
          />
          <KpiCard
            label="Średni lead time"
            value={teeth.avgLeadDays != null ? formatDni(teeth.avgLeadDays) : "brak danych"}
            tone="sky"
            hint={leadHint}
          />
        </div>
        <MetricSourceHint />
      </div>

      {!hasActivity ? (
        <>
          <Alert tone="info">Brak aktywności toru zębów w tym miesiącu.</Alert>
          <EmptyMonthCta
            availableMonths={stats.availableMonths}
            currentKey={stats.monthKey}
            onSelect={onMonthSelect}
          />
        </>
      ) : null}

      {topSupplier ? (
        <HighlightCard
          eyebrow="Najbardziej aktywny dostawca zębów"
          title={topSupplier.supplierName}
          gradientClass="bg-gradient-to-br from-violet-50 to-indigo-50"
          ringClass="ring-violet-200/60"
          iconBgClass="bg-gradient-to-br from-violet-500 to-indigo-600 shadow-violet-500/20"
          iconPath="M12 3c2.5 2 4 4.5 4 7.5S14 17 12 21c-2-4-4-7-4-10.5S9.5 5 12 3z"
        >
          <span>
            <strong className="tabular-nums text-slate-900">{topSupplier.orders}</strong>
            {" "}
            {unitProsby(topSupplier.orders)}
          </span>
          <span>
            <strong className="tabular-nums text-emerald-700">{topSupplier.completed}</strong>
            {" "}
            zrealizowanych
          </span>
        </HighlightCard>
      ) : null}

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Szczegóły
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SecondaryStat label="Anulowane prośby zębów" value={teeth.cancelled} tone="amber" />
          <SecondaryStat
            label="Skuteczność"
            value={`${successRate}%`}
            tone="emerald"
          />
        </div>
      </div>

      <SupplierRanking
        suppliers={teeth.bySupplier}
        title="Dostawcy zębów"
        iconClassName="text-violet-600"
      />
    </div>
  );
}

function resolveInitialTab(
  searchTab: string | null,
  role: UserRole,
  workspaces: Workspace[]
): MonthlySummaryTab {
  if (isMonthlySummaryTab(searchTab)) return searchTab;
  return defaultMonthlySummaryTabForRole(role, workspaces);
}

export function MonthlySummaryClient({
  stats,
  role,
  workspaces = [],
}: {
  stats: MonthlyStats;
  role: UserRole;
  workspaces?: Workspace[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isMonthPending, startMonthTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<MonthlySummaryTab>(() =>
    resolveInitialTab(searchParams.get("tab"), role, workspaces)
  );

  useMarkMonthlySummarySeenOnVisit();

  const quote = useMemo(() => {
    const idx = parseInt(stats.monthKey.split("-")[1] ?? "1", 10) - 1;
    return MOTIVATIONAL_QUOTES[idx % MOTIVATIONAL_QUOTES.length];
  }, [stats.monthKey]);

  function handleTabChange(tab: MonthlySummaryTab) {
    setActiveTab(tab);
    // Bez RSC refetch — URL tylko do deep-link / odświeżenia
    syncTabInUrl(tab);
  }

  function handleMonthSelect(key: string) {
    if (key === stats.monthKey) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", key);
    params.set("tab", activeTab);
    startMonthTransition(() => {
      router.push(`/podsumowanie-miesieczne?${params.toString()}`);
    });
  }

  return (
    <div className="relative mx-auto w-full max-w-4xl space-y-5 2xl:max-w-5xl">
      <Card padding={false}>
        <header className="relative border-b border-slate-100 px-5 py-5">
          <div className="relative space-y-3.5">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md shadow-indigo-600/15">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 3 3 5-5" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <h1 className={cn("text-xl font-bold tracking-tight", brandGradientTextClass)}>
                    Podsumowanie miesiąca
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">{stats.monthLabel}</p>
                </div>
              </div>

              <MonthSelector
                availableMonths={stats.availableMonths}
                currentKey={stats.monthKey}
                onSelect={handleMonthSelect}
                disabled={isMonthPending}
              />
            </div>

            <blockquote className="max-w-2xl border-t border-slate-100/90 pt-3.5 sm:pl-[3.125rem]">
              <p className="text-[13px] leading-[1.55] text-slate-400">
                <span className="select-none text-slate-300" aria-hidden>
                  „
                </span>
                <span className="italic">{quote}</span>
                <span className="select-none text-slate-300" aria-hidden>
                  ”
                </span>
              </p>
            </blockquote>
          </div>
        </header>

        {/*
          Sticky musi mieć rodzica obejmującego także treść działu —
          bez overflow:hidden na przodkach (Card / sticky chrome).
        */}
        <div className="bg-gradient-to-b from-slate-50/80 to-white">
          <div className="px-5 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Wybierz dział
            </p>
            <p className="mt-0.5 text-sm text-slate-600">
              Cztery widoki miesiąca — przełącz bez przeładowania danych.
            </p>
          </div>

          <div className={cn(panelStickyChromeClass, "z-20")}>
            <StickyDepartmentTabs active={activeTab} onChange={handleTabChange} stats={stats} />
          </div>

          <div
            className={cn(
              "bg-white p-5 transition-opacity duration-200",
              isMonthPending && "pointer-events-none opacity-50"
            )}
            role="tabpanel"
            id={`monthly-panel-${activeTab}`}
            aria-labelledby={`monthly-tab-${activeTab}`}
            aria-busy={isMonthPending}
          >
            {isMonthPending ? (
              <p className="mb-4 text-sm font-medium text-indigo-600" aria-live="polite">
                Ładowanie miesiąca…
              </p>
            ) : null}
            {activeTab === "handlowcy" ? (
              <SalesTab stats={stats} onMonthSelect={handleMonthSelect} />
            ) : null}
            {activeTab === "dostawy" ? (
              <DeliveryTab stats={stats} onMonthSelect={handleMonthSelect} />
            ) : null}
            {activeTab === "zakupy" ? (
              <ProcurementTab stats={stats} onMonthSelect={handleMonthSelect} />
            ) : null}
            {activeTab === "zeby" ? (
              <TeethTab stats={stats} onMonthSelect={handleMonthSelect} />
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}
