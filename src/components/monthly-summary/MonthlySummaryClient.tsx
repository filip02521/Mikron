"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import {
  panelWorkspaceShellClass,
  panelTypography,
  controlFocusClass,
  buttonPrimaryClass,
  brandGradientTextClass,
  surfaceCardClass,
} from "@/lib/ui/ontime-theme";
import type { MonthlyStats, MonthlySummaryTab } from "@/lib/data/monthly-stats";
import { isMonthlySummaryAvailable } from "@/lib/data/monthly-stats";

const TAB_META: Record<MonthlySummaryTab, { label: string; hint: string; icon: string }> = {
  handlowcy: { label: "Handlowcy", hint: "Złożone prośby i dokumenty ZK dla każdego handlowca", icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" },
  dostawy: { label: "Dostawy", hint: "Przyjęcia towaru wg kurierów z podziałem na paczki i palety", icon: "M3 7h11v10H3zM14 10h4l3 3v4h-7" },
  zakupy: { label: "Zakupy", hint: "Zamówienia u dostawców, czasy realizacji i ranking", icon: "M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6" },
};

const TAB_ORDER: MonthlySummaryTab[] = ["handlowcy", "dostawy", "zakupy"];

const MOTIVATIONAL_QUOTES = [
  "Dobra organizacja to połowa sukcesu — a statystyki to jej zwierciadło.",
  "Każde zamówienie to historia zaufania. Liczby mówią, jak dobrze ją opowiadamy.",
  "Czas to waluta. Każdy dzień realizacji to inwestycja w relację z klientem.",
  "Najlepszy miesiąc to nie ten bez błędów — to ten, z którego najwięcej się uczymy.",
  "Pomiar jest początkiem wiedzy. To, co mierzymy, rośnie.",
];

const TONE_STYLES: Record<string, { bg: string; text: string; ring: string; iconBg: string; iconText: string; bar: string }> = {
  indigo: { bg: "bg-indigo-50/80", text: "text-indigo-700", ring: "ring-indigo-200/70", iconBg: "bg-indigo-100", iconText: "text-indigo-600", bar: "bg-indigo-500" },
  emerald: { bg: "bg-emerald-50/80", text: "text-emerald-700", ring: "ring-emerald-200/70", iconBg: "bg-emerald-100", iconText: "text-emerald-600", bar: "bg-emerald-500" },
  amber: { bg: "bg-amber-50/80", text: "text-amber-700", ring: "ring-amber-200/70", iconBg: "bg-amber-100", iconText: "text-amber-600", bar: "bg-amber-500" },
  sky: { bg: "bg-sky-50/80", text: "text-sky-700", ring: "ring-sky-200/70", iconBg: "bg-sky-100", iconText: "text-sky-600", bar: "bg-sky-500" },
  violet: { bg: "bg-violet-50/80", text: "text-violet-700", ring: "ring-violet-200/70", iconBg: "bg-violet-100", iconText: "text-violet-600", bar: "bg-violet-500" },
  slate: { bg: "bg-slate-50/80", text: "text-slate-700", ring: "ring-slate-200/70", iconBg: "bg-slate-100", iconText: "text-slate-600", bar: "bg-slate-400" },
};

const STAT_ICONS: Record<string, string> = {
  "Wszystkie złożone prośby": "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5a2 2 0 002 2h2a2 2 0 002-2",
  "Zrealizowane prośby": "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Anulowane prośby": "M10 14L21 3M21 3v6M21 3h-6M21 14a7 7 0 11-14 0 7 7 0 0114 0z",
  "Zamknięte dokumenty ZK": "M5 13l4 4L19 7",
  "Otwarte dokumenty ZK": "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Wskaźnik skuteczności": "M3 3v18h18M7 14l4-4 3 3 5-5",
  "Liczba przyjęć towaru": "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z",
  "Paczki łącznie": "M3 7h18v10H3zM3 7l3-4h12l3 4",
  "Palety łącznie": "M3 7h18v10H3zM7 7v10M11 7v10M15 7v10",
  "Wszystkie zamówienia": "M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6",
  "Zamówienia główne": "M11 3a8 8 0 100 16 8 8 0 000-16zM11 7v4l3 2",
  "Zamówienia poboczne": "M19 21l-7-5-7 5M5 3v18M19 3v18",
  "Zlecenia informacyjne": "M12 16v-4M12 8h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Zrealizowane zamówienia": "M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  "Anulowane zamówienia": "M10 14L21 3M21 3v6M21 3h-6M21 14a7 7 0 11-14 0 7 7 0 0114 0z",
  "Średni czas realizacji": "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
};

function StatCard({
  label,
  value,
  hint,
  tone = "slate",
  progress,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONE_STYLES;
  progress?: number;
}) {
  const t = TONE_STYLES[tone];
  const iconPath = STAT_ICONS[label] ?? "M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z";
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl p-4 ring-1 ring-inset transition-shadow",
        "hover:shadow-[var(--shadow-card-elevated)]",
        t.bg,
        t.ring
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className={cn("mt-2 text-3xl font-bold tabular-nums leading-none", t.text)}>
            {value}
          </p>
          {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            t.iconBg,
            t.iconText
          )}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={iconPath} />
          </svg>
        </span>
      </div>
      {progress != null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200/60">
          <div
            className={cn("h-full rounded-full transition-all duration-500", t.bar)}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function MonthSelector({
  availableMonths,
  currentKey,
  onSelect,
}: {
  availableMonths: { key: string; label: string }[];
  currentKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Wybierz miesiąc
      </span>
      <div className="flex flex-wrap gap-1.5">
        {availableMonths.map((m) => {
          const active = m.key === currentKey;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                controlFocusClass,
                active
                  ? cn(buttonPrimaryClass, "shadow-sm")
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
              )}
              aria-pressed={active}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: MonthlySummaryTab;
  onChange: (tab: MonthlySummaryTab) => void;
}) {
  return (
    <div
      className="flex flex-wrap gap-1 rounded-xl bg-slate-100/70 p-1.5"
      role="tablist"
      aria-label="Sekcje podsumowania"
    >
      {TAB_ORDER.map((tab) => {
        const isActive = active === tab;
        const meta = TAB_META[tab];
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={meta.hint}
            onClick={() => onChange(tab)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
              controlFocusClass,
              isActive
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                : "text-slate-500 hover:text-slate-800"
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
              className={cn(isActive ? "text-indigo-600" : "text-slate-400")}
            >
              <path d={meta.icon} />
            </svg>
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

const MEDAL_META = [
  { label: "1.", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z", bg: "bg-amber-100", text: "text-amber-700", ring: "ring-amber-300/60" },
  { label: "2.", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z", bg: "bg-slate-200", text: "text-slate-600", ring: "ring-slate-400/50" },
  { label: "3.", icon: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z", bg: "bg-orange-100", text: "text-orange-700", ring: "ring-orange-300/60" },
];

function TopPerformerCard({ name, requests, completed, zkClosed }: { name: string; requests: number; completed: number; zkClosed: number }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl p-5 ring-1 ring-inset", "bg-gradient-to-br from-indigo-50 to-violet-50", "ring-indigo-200/60")}>
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-indigo-100/40 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md shadow-amber-500/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600">Lider miesiąca</p>
          <p className="mt-0.5 truncate text-lg font-bold text-slate-900">{name}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span><strong className="tabular-nums text-slate-900">{requests}</strong> złożonych próśb</span>
            <span><strong className="tabular-nums text-emerald-700">{completed}</strong> zrealizowanych próśb</span>
            <span><strong className="tabular-nums text-violet-700">{zkClosed}</strong> zamkniętych ZK</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SalesTab({ stats }: { stats: MonthlyStats }) {
  const { sales } = stats;
  if (sales.length === 0) {
    return (
      <Alert tone="info">Brak aktywności handlowców w tym miesiącu.</Alert>
    );
  }

  const totalRequests = sales.reduce((sum, s) => sum + s.requestsCreated, 0);
  const totalCompleted = sales.reduce((sum, s) => sum + s.requestsCompleted, 0);
  const totalCancelled = sales.reduce((sum, s) => sum + s.requestsCancelled, 0);
  const totalZkClosed = sales.reduce((sum, s) => sum + s.zkClosed, 0);
  const totalZkOpen = sales.reduce((sum, s) => sum + s.zkOpen, 0);
  const successRate = totalRequests > 0 ? Math.round((totalCompleted / totalRequests) * 100) : 0;
  const topPerformer = sales[0];

  return (
    <div className="space-y-5">
      {topPerformer ? (
        <TopPerformerCard
          name={topPerformer.salesPersonName}
          requests={topPerformer.requestsCreated}
          completed={topPerformer.requestsCompleted}
          zkClosed={topPerformer.zkClosed}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Wszystkie złożone prośby" value={totalRequests} tone="indigo" hint="Łączna liczba próśb od handlowców" />
        <StatCard label="Zrealizowane prośby" value={totalCompleted} tone="emerald" hint={totalRequests > 0 ? `${Math.round((totalCompleted / totalRequests) * 100)}% wszystkich złożonych` : undefined} progress={successRate} />
        <StatCard label="Anulowane prośby" value={totalCancelled} tone="amber" hint={totalRequests > 0 ? `${Math.round((totalCancelled / totalRequests) * 100)}% wszystkich złożonych` : undefined} />
        <StatCard label="Zamknięte dokumenty ZK" value={totalZkClosed} tone="violet" hint="Dokumenty ZK zamknięte w tym miesiącu" />
        <StatCard label="Otwarte dokumenty ZK" value={totalZkOpen} tone="sky" hint="Dokumenty ZK oczekujące na zamknięcie" />
        <StatCard
          label="Wskaźnik skuteczności"
          value={`${successRate}%`}
          tone="slate"
          hint="Stosunek zrealizowanych do wszystkich złożonych próśb"
          progress={successRate}
        />
      </div>

      <div className={cn(surfaceCardClass, "overflow-hidden")}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-600">
            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
            Ranking handlowców
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Miejsce</th>
                <th className="px-4 py-2.5 font-medium">Handlowiec</th>
                <th className="px-4 py-2.5 text-right font-medium">Złożone prośby</th>
                <th className="px-4 py-2.5 text-right font-medium">Zrealizowane</th>
                <th className="px-4 py-2.5 text-right font-medium">Anulowane</th>
                <th className="px-4 py-2.5 text-right font-medium">ZK zamknięte</th>
                <th className="px-4 py-2.5 text-right font-medium">ZK otwarte</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s, idx) => {
                const medal = idx < 3 ? MEDAL_META[idx] : null;
                const rate = s.requestsCreated > 0 ? Math.round((s.requestsCompleted / s.requestsCreated) * 100) : 0;
                return (
                  <tr key={s.salesPersonId} className="border-b border-slate-50 last:border-0 transition-colors hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      {medal ? (
                        <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-full ring-1", medal.bg, medal.text, medal.ring)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-indigo-400" style={{ width: `${rate}%` }} />
                        </div>
                        <span className="text-[10px] tabular-nums text-slate-500">{rate}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-700">{s.requestsCreated}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{s.requestsCompleted}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{s.requestsCancelled}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-violet-700">{s.zkClosed}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sky-700">{s.zkOpen}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const CARRIER_LABELS: Record<string, string> = {
  inpost: "InPost",
  dhl: "DHL",
  dpd: "DPD",
  gls: "GLS",
  fedex: "FedEx",
  poczta: "Poczta",
  kurier_dostawcy: "Kurier dostawcy",
  odbior_wlasny: "Odbiór własny",
  inne: "Inne",
};

function DeliveryTab({ stats }: { stats: MonthlyStats }) {
  const { delivery } = stats;
  if (delivery.totalReceipts === 0) {
    return <Alert tone="info">Brak przyjęć towaru w tym miesiącu.</Alert>;
  }

  const maxCarrierCount = Math.max(...delivery.byCarrier.map((c) => c.count), 1);
  const topCarrier = delivery.byCarrier[0];

  return (
    <div className="space-y-5">
      {topCarrier ? (
        <div className={cn("relative overflow-hidden rounded-xl p-5 ring-1 ring-inset", "bg-gradient-to-br from-emerald-50 to-sky-50", "ring-emerald-200/60")}>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-emerald-100/40 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-sky-600 text-white shadow-md shadow-emerald-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" />
                <circle cx="7" cy="18" r="2" />
                <circle cx="17" cy="18" r="2" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Kurier z największą liczbą przyjęć</p>
              <p className="mt-0.5 truncate text-lg font-bold text-slate-900">
                {CARRIER_LABELS[topCarrier.carrier] ?? topCarrier.carrier}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><strong className="tabular-nums text-slate-900">{topCarrier.count}</strong> przyjęć towaru</span>
                <span><strong className="tabular-nums text-sky-700">{topCarrier.packages}</strong> paczek</span>
                <span><strong className="tabular-nums text-amber-700">{topCarrier.pallets}</strong> palet</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Liczba przyjęć towaru" value={delivery.totalReceipts} tone="emerald" hint="Wszystkie zarejestrowane przyjęcia na magazyn" />
        <StatCard label="Paczki łącznie" value={delivery.totalPackages} tone="sky" hint="Suma paczek ze wszystkich przyjęć" />
        <StatCard label="Palety łącznie" value={delivery.totalPallets} tone="amber" hint="Suma palet ze wszystkich przyjęć" />
      </div>

      {delivery.byCarrier.length > 0 ? (
        <div className={cn(surfaceCardClass, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600">
              <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7" />
              <circle cx="7" cy="18" r="2" />
              <circle cx="17" cy="18" r="2" />
            </svg>
            <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
              Przyjęcia wg kuriera
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {delivery.byCarrier.map((c) => {
              const pct = Math.round((c.count / maxCarrierCount) * 100);
              return (
                <div key={c.carrier} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-slate-50/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {CARRIER_LABELS[c.carrier] ?? c.carrier}
                      </p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{c.count}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{pct}%</span>
                    </div>
                    <div className="mt-1.5 flex gap-4 text-[11px] text-slate-500">
                      <span><strong className="tabular-nums text-sky-700">{c.packages}</strong> paczek</span>
                      <span><strong className="tabular-nums text-amber-700">{c.pallets}</strong> palet</span>
                      <span className="text-slate-400">z {c.count} przyjęć</span>
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

function ProcurementTab({ stats }: { stats: MonthlyStats }) {
  const { procurement } = stats;
  if (procurement.totalOrders === 0 && procurement.informacjaCount === 0) {
    return <Alert tone="info">Brak zamówień w tym miesiącu.</Alert>;
  }

  const successRate = procurement.totalOrders > 0
    ? Math.round((procurement.completedOrders / procurement.totalOrders) * 100)
    : 0;
  const topSupplier = procurement.bySupplier[0];
  const maxSupplierOrders = Math.max(...procurement.bySupplier.map((s) => s.orders), 1);

  return (
    <div className="space-y-5">
      {topSupplier ? (
        <div className={cn("relative overflow-hidden rounded-xl p-5 ring-1 ring-inset", "bg-gradient-to-br from-amber-50 to-indigo-50", "ring-amber-200/60")}>
          <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-amber-100/40 blur-2xl" />
          <div className="relative flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-indigo-600 text-white shadow-md shadow-amber-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6" />
                <circle cx="9" cy="20" r="1" />
                <circle cx="18" cy="20" r="1" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Najbardziej aktywny dostawca</p>
              <p className="mt-0.5 truncate text-lg font-bold text-slate-900">{topSupplier.supplierName}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                <span><strong className="tabular-nums text-slate-900">{topSupplier.orders}</strong> złożonych zamówień</span>
                <span><strong className="tabular-nums text-emerald-700">{topSupplier.completed}</strong> zrealizowanych zamówień</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Wszystkie zamówienia" value={procurement.totalOrders} tone="indigo" hint="Łączna liczba zamówień u dostawców" />
        <StatCard label="Zamówienia główne" value={procurement.mainOrders} tone="emerald" hint={procurement.totalOrders > 0 ? `${Math.round((procurement.mainOrders / procurement.totalOrders) * 100)}% wszystkich zamówień` : undefined} progress={procurement.totalOrders > 0 ? Math.round((procurement.mainOrders / procurement.totalOrders) * 100) : 0} />
        <StatCard label="Zamówienia poboczne" value={procurement.sideOrders} tone="sky" hint={procurement.totalOrders > 0 ? `${Math.round((procurement.sideOrders / procurement.totalOrders) * 100)}% wszystkich zamówień` : undefined} />
        <StatCard label="Zlecenia informacyjne" value={procurement.informacjaCount} tone="slate" hint="Zapytania informacyjne (nie zamówienia)" />
        <StatCard label="Zrealizowane zamówienia" value={procurement.completedOrders} tone="emerald" hint={procurement.totalOrders > 0 ? `${successRate}% wszystkich zamówień` : undefined} progress={successRate} />
        <StatCard label="Anulowane zamówienia" value={procurement.cancelledOrders} tone="amber" hint={procurement.totalOrders > 0 ? `${Math.round((procurement.cancelledOrders / procurement.totalOrders) * 100)}% wszystkich zamówień` : undefined} />
        <StatCard
          label="Średni czas realizacji"
          value={procurement.avgDeliveryDays != null ? `${procurement.avgDeliveryDays} dni` : "brak danych"}
          tone="violet"
          hint="Od zamówienia u dostawcy do dostawy (średnia)"
        />
        <StatCard
          label="Wskaźnik skuteczności"
          value={`${successRate}%`}
          tone="slate"
          hint="Stosunek zrealizowanych do wszystkich zamówień"
          progress={successRate}
        />
      </div>

      {procurement.bySupplier.length > 0 ? (
        <div className={cn(surfaceCardClass, "overflow-hidden")}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
              <path d="M3 3h2l2.4 12.5a2 2 0 002 1.5h7.7a2 2 0 002-1.6L21 8H6" />
              <circle cx="9" cy="20" r="1" />
              <circle cx="18" cy="20" r="1" />
            </svg>
            <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
              Ranking dostawców
            </h3>
          </div>
          <div className="divide-y divide-slate-50">
            {procurement.bySupplier.map((s, idx) => {
              const pct = Math.round((s.orders / maxSupplierOrders) * 100);
              const completionRate = s.orders > 0 ? Math.round((s.completed / s.orders) * 100) : 0;
              return (
                <div key={s.supplierId} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/50">
                  <span className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums",
                    idx === 0 ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300/60"
                    : idx === 1 ? "bg-slate-200 text-slate-600 ring-1 ring-slate-400/50"
                    : idx === 2 ? "bg-orange-100 text-orange-700 ring-1 ring-orange-300/60"
                    : "text-slate-400"
                  )}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{s.supplierName}</p>
                      <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900">{s.orders}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-indigo-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-500">{pct}%</span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">
                      <strong className="tabular-nums text-emerald-700">{s.completed}</strong> zrealizowanych zamówień
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className="tabular-nums">{completionRate}% skuteczności realizacji</span>
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

export function MonthlySummaryClient({ stats }: { stats: MonthlyStats }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as MonthlySummaryTab) ?? "handlowcy";
  const [activeTab, setActiveTab] = useState<MonthlySummaryTab>(
    TAB_ORDER.includes(initialTab) ? initialTab : "handlowcy"
  );

  const showBanner = useMemo(() => isMonthlySummaryAvailable(), []);
  const quote = useMemo(() => {
    const idx = parseInt(stats.monthKey.split("-")[1] ?? "1", 10) - 1;
    return MOTIVATIONAL_QUOTES[idx % MOTIVATIONAL_QUOTES.length];
  }, [stats.monthKey]);

  function handleTabChange(tab: MonthlySummaryTab) {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/podsumowanie-miesieczne?${params.toString()}`);
  }

  function handleMonthSelect(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", key);
    router.push(`/podsumowanie-miesieczne?${params.toString()}`);
  }

  return (
    <div className={cn(panelWorkspaceShellClass, "space-y-5")}>
      {showBanner ? (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200/70 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3 shadow-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-indigo-900">
              Dostępne jest podsumowanie za {stats.monthLabel}
            </p>
            <p className="text-xs text-indigo-700">
              Sprawdź statystyki zespołu za miniony miesiąc.
            </p>
          </div>
        </div>
      ) : null}

      <Card padding={false}>
        <div className="relative overflow-hidden border-b border-slate-100 px-5 py-5">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-50/50 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md shadow-indigo-600/15">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3v18h18" />
                    <path d="M7 14l4-4 3 3 5-5" />
                  </svg>
                </span>
                <div>
                  <h1 className={cn("text-xl font-bold tracking-tight", brandGradientTextClass)}>
                    Podsumowanie miesiąca
                  </h1>
                  <p className="mt-0.5 text-sm font-medium text-slate-500">{stats.monthLabel}</p>
                </div>
              </div>
            </div>
            <MonthSelector
              availableMonths={stats.availableMonths}
              currentKey={stats.monthKey}
              onSelect={handleMonthSelect}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/40 px-5 py-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-violet-400">
            <path d="M6 17l6-5 6 5M6 12l6-5 6 5" />
          </svg>
          <p className="text-xs italic leading-relaxed text-slate-500">
            {quote}
          </p>
        </div>

        <div className="px-5 pt-4">
          <TabBar active={activeTab} onChange={handleTabChange} />
        </div>

        <div className="p-5">
          {activeTab === "handlowcy" ? <SalesTab stats={stats} /> : null}
          {activeTab === "dostawy" ? <DeliveryTab stats={stats} /> : null}
          {activeTab === "zakupy" ? <ProcurementTab stats={stats} /> : null}
        </div>
      </Card>
    </div>
  );
}
