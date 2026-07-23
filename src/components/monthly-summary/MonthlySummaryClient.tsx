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
} from "@/lib/ui/ontime-theme";
import type { MonthlyStats, MonthlySummaryTab } from "@/lib/data/monthly-stats";
import { isMonthlySummaryAvailable } from "@/lib/data/monthly-stats";

const TAB_META: Record<MonthlySummaryTab, { label: string; hint: string }> = {
  handlowcy: { label: "Handlowcy", hint: "Statystyki prośb i ZK per handlowiec" },
  dostawy: { label: "Dostawy", hint: "Przyjęte paczki, palety i kurierzy" },
  zakupy: { label: "Zakupy", hint: "Zamówienia u dostawców i czasy realizacji" },
};

const TAB_ORDER: MonthlySummaryTab[] = ["handlowcy", "dostawy", "zakupy"];

const TONE_STYLES: Record<string, { bg: string; text: string; ring: string }> = {
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", ring: "ring-indigo-200" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-200" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", ring: "ring-amber-200" },
  sky: { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-200" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-200" },
  slate: { bg: "bg-slate-50", text: "text-slate-700", ring: "ring-slate-200" },
};

function StatCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: keyof typeof TONE_STYLES;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className={cn("rounded-lg p-4 ring-1 ring-inset", t.bg, t.ring)}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-1.5 text-2xl font-bold tabular-nums", t.text)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
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
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Miesiąc:</span>
      <div className="flex flex-wrap gap-1.5">
        {availableMonths.map((m) => {
          const active = m.key === currentKey;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => onSelect(m.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                controlFocusClass,
                active
                  ? cn(buttonPrimaryClass, "shadow-sm")
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
      className="flex flex-wrap gap-1 rounded-md bg-slate-50/60 p-1"
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
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              controlFocusClass,
              isActive
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {meta.label}
          </button>
        );
      })}
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Łącznie próśb" value={totalRequests} tone="indigo" />
        <StatCard label="Zrealizowane" value={totalCompleted} tone="emerald" />
        <StatCard label="Anulowane" value={totalCancelled} tone="amber" />
        <StatCard label="ZK zamknięte" value={totalZkClosed} tone="violet" />
        <StatCard label="ZK otwarte" value={totalZkOpen} tone="sky" />
        <StatCard
          label="Skuteczność"
          value={totalRequests > 0 ? `${Math.round((totalCompleted / totalRequests) * 100)}%` : "—"}
          tone="slate"
          hint="Zrealizowane / łącznie próśb"
        />
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
            Handlowcy
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Handlowiec</th>
                <th className="px-4 py-2.5 text-right font-medium">Próśb</th>
                <th className="px-4 py-2.5 text-right font-medium">Zrealiz.</th>
                <th className="px-4 py-2.5 text-right font-medium">Anulow.</th>
                <th className="px-4 py-2.5 text-right font-medium">ZK zamkn.</th>
                <th className="px-4 py-2.5 text-right font-medium">ZK otwarte</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.salesPersonId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.salesPersonName}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.requestsCreated}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{s.requestsCompleted}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-700">{s.requestsCancelled}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-violet-700">{s.zkClosed}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-sky-700">{s.zkOpen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function DeliveryTab({ stats }: { stats: MonthlyStats }) {
  const { delivery } = stats;
  if (delivery.totalReceipts === 0) {
    return <Alert tone="info">Brak przyjęć towaru w tym miesiącu.</Alert>;
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Łącznie przyjęć" value={delivery.totalReceipts} tone="emerald" />
        <StatCard label="Paczki" value={delivery.totalPackages} tone="sky" />
        <StatCard label="Palety" value={delivery.totalPallets} tone="amber" />
      </div>

      {delivery.byCarrier.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
              Według kuriera
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Kurier</th>
                  <th className="px-4 py-2.5 text-right font-medium">Przyjęcia</th>
                  <th className="px-4 py-2.5 text-right font-medium">Paczki</th>
                  <th className="px-4 py-2.5 text-right font-medium">Palety</th>
                </tr>
              </thead>
              <tbody>
                {delivery.byCarrier.map((c) => (
                  <tr key={c.carrier} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {CARRIER_LABELS[c.carrier] ?? c.carrier}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.count}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sky-700">{c.packages}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-700">{c.pallets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Zamówienia" value={procurement.totalOrders} tone="indigo" />
        <StatCard label="Główne" value={procurement.mainOrders} tone="emerald" />
        <StatCard label="Poboczne" value={procurement.sideOrders} tone="sky" />
        <StatCard label="Informacje" value={procurement.informacjaCount} tone="slate" />
        <StatCard label="Zrealizowane" value={procurement.completedOrders} tone="emerald" />
        <StatCard label="Anulowane" value={procurement.cancelledOrders} tone="amber" />
        <StatCard
          label="Śr. czas realizacji"
          value={procurement.avgDeliveryDays != null ? `${procurement.avgDeliveryDays} dni` : "—"}
          tone="violet"
          hint="Od zamówienia do dostawy"
        />
        <StatCard
          label="Skuteczność"
          value={
            procurement.totalOrders > 0
              ? `${Math.round((procurement.completedOrders / procurement.totalOrders) * 100)}%`
              : "—"
          }
          tone="slate"
          hint="Zrealizowane / łącznie zamówień"
        />
      </div>

      {procurement.bySupplier.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className={cn(panelTypography.rowTitle, "font-semibold text-slate-900")}>
              Top dostawcy
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Dostawca</th>
                  <th className="px-4 py-2.5 text-right font-medium">Zamówienia</th>
                  <th className="px-4 py-2.5 text-right font-medium">Zrealizowane</th>
                </tr>
              </thead>
              <tbody>
                {procurement.bySupplier.map((s) => (
                  <tr key={s.supplierId} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.supplierName}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{s.orders}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-emerald-700">{s.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
        <div className="flex items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              Sprawdź statystyki swojego zespołu na początki miesiąca.
            </p>
          </div>
        </div>
      ) : null}

      <Card padding={false}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900">
              Podsumowanie miesiąca
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{stats.monthLabel}</p>
          </div>
          <MonthSelector
            availableMonths={stats.availableMonths}
            currentKey={stats.monthKey}
            onSelect={handleMonthSelect}
          />
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
