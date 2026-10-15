"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { daysFromToday, formatDaysAhead } from "@/components/summary/SupplierStockSignal";
import { stockWatchHorizonDays, stockWatchPrepareZdUsesHorizon } from "@/lib/stock-watch/signal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSummaryMetric } from "@/components/ui/PanelSummaryMetric";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconChartTrend,
  IconSearch,
  IconSettings,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import {
  actionSearchStockWatchItems,
  actionStartStockWatchRun,
} from "@/app/actions/stock-watch";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import { polishPluralWord, polishPozycjeLabel } from "@/lib/email/polish-plural";
import { buttonPrimaryClass } from "@/lib/ui/ontime-theme";
import type {
  StockWatchDashboard,
  StockWatchRowView,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
import { isStockWatchEmptyNoIncoming } from "@/lib/stock-watch/analysis";
import { StockHealthGauge } from "@/components/stock-watch/StockHealthGauge";
import { StockCoverBar } from "@/components/stock-watch/StockCoverBar";
import { StockRuleControl, StockRuleMenu } from "@/components/stock-watch/StockRuleControl";
import {
  formatCover,
  formatPln,
  formatQtyPl,
  formatRunOutDate,
  formatVelocity,
  STOCK_WATCH_RULE_META,
  STOCK_WATCH_STATUS_META,
} from "@/components/stock-watch/stock-watch-format";

export type StockWatchRunSummary = {
  status: "running" | "ok" | "partial" | "failed";
  runDate: string;
  startedAt: string;
  finishedAt: string | null;
  heartbeatAt: string;
  salesEndDate: string;
  scopesTotal: number;
  scopesDone: number;
  failures: { supplierName: string; message: string }[];
};

type TabId = "alerts" | "suppliers" | "rotation" | "rules";
const TAB_IDS: readonly TabId[] = ["alerts", "suppliers", "rotation", "rules"];
type AlertFilter = "all" | "empty_no_incoming" | "out_of_stock" | "critical" | "before_delivery";
const ALERT_FILTER_IDS: readonly AlertFilter[] = [
  "all",
  "empty_no_incoming",
  "out_of_stock",
  "critical",
  "before_delivery",
];

function isTabId(v: string | null | undefined): v is TabId {
  return TAB_IDS.includes(v as TabId);
}

function isAlertFilter(v: string | null | undefined): v is AlertFilter {
  return ALERT_FILTER_IDS.includes(v as AlertFilter);
}

function parseAlertFilterParam(raw: string | null | undefined): AlertFilter | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  if (key === "puste" || key === "empty" || key === "empty_no_incoming") return "empty_no_incoming";
  if (isAlertFilter(key)) return key;
  return null;
}

function matchesAlertFilter(row: StockWatchRowView, filter: AlertFilter): boolean {
  if (filter === "all") return true;
  if (filter === "empty_no_incoming") return isStockWatchEmptyNoIncoming(row);
  if (filter === "before_delivery") return row.deliveryRisk === "before_delivery";
  return row.status === filter;
}

const dateTimeFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Warsaw",
});

function formatShortDate(key: string): string {
  const [, m, d] = key.split("-");
  return m && d ? `${d}.${m}` : key;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : dateTimeFormatter.format(d);
}

export function StockWatchPanel({
  dashboard,
  run,
  canMutate,
  coverage,
  initialSupplierId = null,
  initialSupplierName = null,
  initialTab = null,
  initialAlertFilter = null,
}: {
  dashboard: StockWatchDashboard;
  run: StockWatchRunSummary | null;
  canMutate: boolean;
  /** Aktywni dostawcy vs z zakresem w kreatorze ZD (tylko ci są analizowani). */
  coverage: { active: number; mapped: number };
  /** `?dostawca=` — link „N pilne” z panelu dziennego. */
  initialSupplierId?: string | null;
  /** Nazwa z wyników analizy — także gdy dostawca nie ma nic do zamówienia. */
  initialSupplierName?: string | null;
  /** `?tab=alerts|suppliers|rotation|rules` */
  initialTab?: string | null;
  /** `?filtr=puste` — same produkty bez stanu i bez otwartego ZD. */
  initialAlertFilter?: string | null;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const parsedFilter = parseAlertFilterParam(initialAlertFilter);
  const [tab, setTab] = useState<TabId>(() => {
    if (isTabId(initialTab)) return initialTab;
    if (parsedFilter) return "alerts";
    if (initialSupplierId) {
      return dashboard.alerts.some((r) => r.supplierId === initialSupplierId) ? "alerts" : "suppliers";
    }
    return dashboard.alerts.length > 0 ? "alerts" : "suppliers";
  });
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(() => parsedFilter ?? "all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, startRun] = useTransition();

  const running = run?.status === "running";

  // Analiza w toku — odświeżaj co 10 s, aż worker skończy.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => router.refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [running, router]);

  const hasData = dashboard.totals.itemCount > 0;

  const onStartRun = () => {
    setError(null);
    startRun(async () => {
      const res = await actionStartStockWatchRun();
      if (!res.ok) {
        setError(
          `Nie udało się uruchomić analizy: ${res.message.replace(/\.\s*$/, "")}. Spróbuj ponownie za kilka minut.`
        );
        return;
      }
      setNotice("Analiza uruchomiona w tle - wyniki odświeżą się same (zwykle kilka minut).");
      window.setTimeout(() => router.refresh(), 1500);
    });
  };

  const alerts = useMemo(
    () => (supplierId ? dashboard.alerts.filter((r) => r.supplierId === supplierId) : dashboard.alerts),
    [dashboard.alerts, supplierId]
  );
  const proposals = useMemo(
    () =>
      supplierId ? dashboard.proposals.filter((p) => p.supplierId === supplierId) : dashboard.proposals,
    [dashboard.proposals, supplierId]
  );
  const supplierName = supplierId
    ? (dashboard.proposals.find((p) => p.supplierId === supplierId)?.supplierName ??
      dashboard.alerts.find((r) => r.supplierId === supplierId)?.supplierName ??
      (supplierId === initialSupplierId ? initialSupplierName : null) ??
      "spoza analizy")
    : null;

  const syncBrakiUrl = (next: { supplierId?: string | null; filter?: AlertFilter; tab?: TabId }) => {
    const sid = next.supplierId === undefined ? supplierId : next.supplierId;
    const filter = next.filter === undefined ? alertFilter : next.filter;
    const nextTab = next.tab === undefined ? tab : next.tab;
    const params = new URLSearchParams();
    if (sid) params.set("dostawca", sid);
    if (nextTab !== "alerts" && nextTab !== "suppliers") params.set("tab", nextTab);
    else if (nextTab === "suppliers" && !sid) params.set("tab", "suppliers");
    if (filter === "empty_no_incoming") params.set("filtr", "puste");
    else if (filter !== "all") params.set("filtr", filter);
    const qs = params.toString();
    router.replace(qs ? `/zakupy/braki?${qs}` : "/zakupy/braki", { scroll: false });
  };

  const clearSupplier = () => {
    setSupplierId(null);
    syncBrakiUrl({ supplierId: null });
  };

  const jumpToAlerts = (filter: AlertFilter) => {
    setAlertFilter(filter);
    setTab("alerts");
    syncBrakiUrl({ filter, tab: "alerts" });
  };

  const emptyNoIncomingCount = useMemo(
    () =>
      (supplierId
        ? dashboard.alerts.filter((r) => r.supplierId === supplierId)
        : dashboard.alerts
      ).filter(isStockWatchEmptyNoIncoming).length,
    [dashboard.alerts, supplierId]
  );

  const tabs: { id: TabId; label: string; count?: number; tone?: "danger" | "warning" }[] = [
    { id: "alerts", label: "Do zamówienia dziś", count: alerts.length, tone: "danger" },
    { id: "suppliers", label: "Do ZD po dostawcach", count: proposals.length },
    { id: "rotation", label: "Rotacja", count: dashboard.topVelocity.length },
    { id: "rules", label: "Reguły", count: dashboard.flagged.length },
  ];

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const idx = TAB_IDS.indexOf(tab);
    const next =
      e.key === "ArrowRight"
        ? TAB_IDS[(idx + 1) % TAB_IDS.length]
        : e.key === "ArrowLeft"
          ? TAB_IDS[(idx - 1 + TAB_IDS.length) % TAB_IDS.length]
          : e.key === "Home"
            ? TAB_IDS[0]
            : e.key === "End"
              ? TAB_IDS[TAB_IDS.length - 1]
              : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    document.getElementById(`stock-watch-tabbtn-${next}`)?.focus();
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title="Braki"
        hint="Nocna analiza rotacji (ten sam silnik co Kreator ZD). „Przygotuj ZD” otwiera kreator z gotową listą."
        description="Co się kończy — i czy coś już jedzie. Zamów zanim zrobi się dziura na półce."
        actions={
          <>
            <RunStatusChip run={run} />
            {canMutate ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onStartRun}
                disabled={starting || running}
                className="cursor-pointer active:scale-[0.98]"
                title="Przelicza wszystkich dostawców z mapowaniem zakresu (odczyt z Subiekta, kilka minut)"
              >
                {starting || running ? <Spinner size="sm" className="mr-1.5" /> : null}
                {running ? "Analiza w toku…" : "Przelicz teraz"}
              </Button>
            ) : null}
          </>
        }
      />

      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {run && run.failures.length > 0 ? (
        <Alert
          tone="warning"
          title={`Nie przeliczono ${run.failures.length} ${polishPluralWord(run.failures.length, "dostawcy", "dostawców", "dostawców")} — ich listy są z poprzedniej nocy. Sprawdź zakres w Kreatorze ZD.`}
        >
          {run.failures
            .slice(0, 4)
            .map((f) => `${f.supplierName}: ${f.message}`)
            .join(" · ")}
          {run.failures.length > 4 ? ` · …i ${run.failures.length - 4} więcej` : ""}
        </Alert>
      ) : null}

      {!hasData ? (
        <Card>
          <EmptyState
            brandAccent
            icon={<IconChartTrend size={28} strokeWidth={1.75} />}
            title={running ? "Pierwsza analiza w toku" : "Brak wyników analizy"}
            description={
              running
                ? "Liczymy rotację dla dostawców z mapowaniem zakresu. Panel odświeży się sam."
                : "Analiza działa co noc (5:30–6:30) dla dostawców z przypisaną grupą lub cechą w kreatorze ZD. Możesz uruchomić ją teraz."
            }
            action={
              canMutate && !running ? (
                <Button onClick={onStartRun} disabled={starting} className="cursor-pointer">
                  Uruchom analizę
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          {supplierId ? null : (
            <OverviewBand dashboard={dashboard} onJumpAlerts={jumpToAlerts} onJump={setTab} />
          )}
          {!supplierId && coverage.active > coverage.mapped ? (
            <p className="px-0.5 text-xs leading-relaxed text-slate-500">
              Analiza obejmuje{" "}
              <span className="font-semibold tabular-nums text-slate-700">{coverage.mapped}</span> z{" "}
              <span className="tabular-nums">{coverage.active}</span> aktywnych dostawców.{" "}
              {coverage.active - coverage.mapped} bez grupy/cechy —{" "}
              <Link
                href="/zakupy/szacunek"
                className="cursor-pointer font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 transition-colors hover:text-indigo-900 hover:decoration-indigo-600"
              >
                ustaw zakresy w Kreatorze ZD
              </Link>
              .
            </p>
          ) : null}

          <div
            role="tablist"
            aria-label="Sekcje panelu braków"
            className="sticky top-0 z-10 -mx-1 flex gap-0.5 overflow-x-auto rounded-lg border border-slate-200/90 bg-white/95 p-1 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/80"
          >
            {tabs.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  id={`stock-watch-tabbtn-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`stock-watch-tab-${t.id}`}
                  tabIndex={active ? 0 : -1}
                  onClick={() => {
                    setTab(t.id);
                    syncBrakiUrl({ tab: t.id });
                  }}
                  onKeyDown={onTabKeyDown}
                  className={cn(
                    "inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow] duration-150 ease-out sm:min-h-9",
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  {t.label}
                  {t.count != null && t.count > 0 ? (
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                        active
                          ? "bg-white/15 text-white"
                          : t.tone === "danger"
                            ? "bg-red-50 text-red-700"
                            : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {t.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {supplierName ? (
            <div className="flex flex-wrap items-center gap-2 px-0.5">
              <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50/80 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-800">
                Dostawca: {supplierName}
                <button
                  type="button"
                  onClick={clearSupplier}
                  className="inline-flex size-7 cursor-pointer items-center justify-center rounded text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
                  aria-label={`Usuń filtr dostawcy ${supplierName}`}
                >
                  ×
                </button>
              </span>
              <span className="text-xs text-slate-500">
                Listy „Do zamówienia dziś” i „Do ZD” tylko dla tego dostawcy.
              </span>
            </div>
          ) : null}

          <section
            id={`stock-watch-tab-${tab}`}
            role="tabpanel"
            aria-labelledby={`stock-watch-tabbtn-${tab}`}
          >
            {tab === "alerts" ? (
              <AlertsSection
                rows={alerts}
                filter={alertFilter}
                emptyNoIncomingTotal={
                  supplierId ? emptyNoIncomingCount : dashboard.counts.emptyNoIncoming
                }
                onFilterChange={(filter) => {
                  setAlertFilter(filter);
                  syncBrakiUrl({ filter, tab: "alerts" });
                }}
                canMutate={canMutate}
                onError={setError}
              />
            ) : tab === "suppliers" ? (
              <SuppliersSection proposals={proposals} canMutate={canMutate} filtered={supplierId != null} />
            ) : tab === "rotation" ? (
              <RotationSection rows={dashboard.topVelocity} canMutate={canMutate} onError={setError} />
            ) : (
              <RulesSection flagged={dashboard.flagged} canMutate={canMutate} onError={setError} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function RunStatusChip({ run }: { run: StockWatchRunSummary | null }) {
  if (!run) {
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200/90 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
        Analiza jeszcze nie działała
      </span>
    );
  }
  const tone =
    run.status === "partial"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : run.status === "failed"
        ? "border-red-200 bg-red-50/90 text-red-800"
        : run.status === "running"
          ? "border-indigo-200 bg-indigo-50/80 text-indigo-900"
          : "border-slate-200/90 bg-slate-50 text-slate-600";
  const label =
    run.status === "running"
      ? `Liczę: ${run.scopesDone}/${run.scopesTotal} dostawców`
      : `Analiza ${formatWhen(run.finishedAt ?? run.heartbeatAt)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium tabular-nums",
        tone
      )}
      title={`Sprzedaż do ${run.salesEndDate} · dostawcy ${run.scopesDone}/${run.scopesTotal}`}
    >
      {run.status === "running" ? (
        <span className="size-1.5 rounded-full bg-indigo-500 motion-safe:animate-pulse" aria-hidden />
      ) : null}
      {label}
    </span>
  );
}

function OverviewBand({
  dashboard,
  onJump,
  onJumpAlerts,
}: {
  dashboard: StockWatchDashboard;
  onJump: (tab: TabId) => void;
  onJumpAlerts: (filter: AlertFilter) => void;
}) {
  const { counts, totals, health } = dashboard;
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-stretch md:gap-5">
        <div className="shrink-0 md:w-[9.5rem] md:border-r md:border-slate-100 md:pr-5">
          <StockHealthGauge score={health.score} active={health.active} ok={health.ok} />
          {counts.noSales > 0 ? (
            <p className="mt-1.5 text-[11px] tabular-nums text-slate-500">
              Bez sprzedaży: {counts.noSales}
            </p>
          ) : null}
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <PanelSummaryMetric
            label="Puste · bez dostawy"
            value={counts.emptyNoIncoming}
            hint="Zero na stanie i nic w otwartych ZD"
            tone={counts.emptyNoIncoming > 0 ? "danger" : "success"}
            onClick={() => onJumpAlerts("empty_no_incoming")}
            title="Pokaż towary bez stanu i bez towaru w drodze"
            className={
              counts.emptyNoIncoming > 0
                ? "border-red-200/90 bg-red-50/40 ring-1 ring-red-100/80"
                : undefined
            }
          />
          <PanelSummaryMetric
            label="Brak towaru"
            value={counts.outOfStock}
            hint={
              counts.outOfStock > counts.emptyNoIncoming
                ? `${counts.outOfStock - counts.emptyNoIncoming} z towarem w drodze`
                : "Stan dostępny ≤ 0"
            }
            tone={counts.outOfStock > 0 ? "danger" : "success"}
            onClick={() => onJumpAlerts("out_of_stock")}
          />
          <PanelSummaryMetric
            label="≤ 48 h"
            value={counts.critical}
            hint="Skończy się przy obecnym tempie"
            tone={counts.critical > 0 ? "danger" : "success"}
            onClick={() => onJumpAlerts("critical")}
          />
          <PanelSummaryMetric
            label="Przed dostawą"
            value={counts.beforeDelivery}
            hint={
              counts.beforeNextDelivery > 0
                ? `+ ${counts.beforeNextDelivery} przed kolejną dostawą`
                : "Skończy się przed dzisiejszym ZD"
            }
            tone={counts.beforeDelivery > 0 ? "danger" : "success"}
            onClick={() => onJumpAlerts("before_delivery")}
          />
          <PanelSummaryMetric
            label="Poniżej celu"
            value={counts.warning}
            hint="Na listach „Do ZD” — uzupełnienie zapasu"
            tone={counts.warning > 0 ? "warning" : "success"}
          />
          <PanelSummaryMetric
            label="Wartość do ZD"
            value={formatPln(totals.proposalValue)}
            hint={`${polishPozycjeLabel(totals.proposalLines)} · ${dashboard.proposals.length} ${polishPluralWord(dashboard.proposals.length, "dostawca", "dostawcy", "dostawców")}`}
            onClick={() => onJump("suppliers")}
          />
        </div>
      </div>
    </Card>
  );
}

/** Przełącznik: same produkty bez stanu i bez otwartego ZD. */
function EmptyShelfSwitch({
  checked,
  count,
  onChange,
}: {
  checked: boolean;
  count: number;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-[border-color,background-color,box-shadow] duration-150 ease-out sm:w-auto sm:min-h-9 sm:py-1.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 active:scale-[0.99]",
        checked
          ? "border-red-300 bg-red-50/95 text-red-950 shadow-sm ring-1 ring-red-200/70"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      )}
      title="Pokaż tylko towary bez stanu dostępnego i bez sztuk na otwartych ZD"
    >
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ease-out",
          checked ? "bg-red-600" : "bg-slate-300"
        )}
        aria-hidden
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold leading-tight">Puste · bez dostawy</span>
        <span className={cn("block text-[11px] leading-tight", checked ? "text-red-800/80" : "text-slate-500")}>
          Bez stanu i bez ZD w drodze
          {count > 0 ? (
            <span className="ml-1 font-semibold tabular-nums">({count})</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}

function ProductCell({ row }: { row: Pick<StockWatchRowView, "twSymbol" | "twNazwa" | "grtNazwa"> }) {
  return (
    <div className="min-w-0 max-w-[16rem]">
      <p className="truncate font-mono text-[13px] font-semibold text-slate-900" title={row.twSymbol ?? undefined}>
        {row.twSymbol ?? "-"}
      </p>
      <p className="truncate text-xs text-slate-500" title={row.twNazwa}>
        {row.twNazwa}
      </p>
    </div>
  );
}

function CoverChip({
  row,
}: {
  row: Pick<StockWatchRowView, "daysOfCover" | "status" | "runOutDate" | "deliveryRisk">;
}) {
  const meta = STOCK_WATCH_STATUS_META[row.status];
  const runOut = formatRunOutDate(row.runOutDate);
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge variant={meta.badge} className="whitespace-nowrap tabular-nums">
        {formatCover(row.daysOfCover, row.status)}
      </Badge>
      {runOut && row.status !== "out_of_stock" ? (
        <span className="text-xs text-slate-500">koniec ok. {runOut}</span>
      ) : null}
      {row.deliveryRisk ? <DeliveryRiskTag risk={row.deliveryRisk} /> : null}
    </div>
  );
}

function DeliveryRiskTag({ risk }: { risk: NonNullable<StockWatchRowView["deliveryRisk"]> }) {
  return risk === "before_delivery" ? (
    <span
      className="whitespace-nowrap rounded-md bg-red-50 px-1.5 text-xs font-medium text-red-800"
      title="Przy obecnym tempie sprzedaży (z towarem w drodze) skończy się, zanim przyjedzie zamówienie złożone dziś."
    >
      przed dostawą
    </span>
  ) : (
    <span
      className="whitespace-nowrap rounded-md bg-amber-50 px-1.5 text-xs font-medium text-amber-900"
      title="Skończy się przed dostawą z kolejnego planowego zamówienia - warto zamówić wcześniej."
    >
      przed kolejną dostawą
    </span>
  );
}

function VelocityCell({
  row,
}: {
  row: Pick<StockWatchRowView, "velocityDaily" | "salesPeriodQty" | "salesPeriodDays">;
}) {
  return (
    <div className="whitespace-nowrap text-right tabular-nums">
      <span className="font-semibold text-slate-900">{formatVelocity(row.velocityDaily)}</span>
      <span className="text-xs text-slate-500">/d</span>
      <p className="text-[11px] text-slate-500" title="Sprzedaż w oknie Kreatora (dni zapasu dostawcy)">
        {formatQtyPl(row.salesPeriodQty)} szt / {row.salesPeriodDays} d
      </p>
    </div>
  );
}

/** „Do ZD” z silnika — ilość na dokumencie, jak w Kreatorze. */
function OrderQty({
  row,
}: {
  row: Pick<StockWatchRowView, "inOrder" | "orderZdUnits" | "orderUnitLabel" | "orderPieces">;
}) {
  if (!row.inOrder || row.orderZdUnits <= 0) {
    return (
      <span className="whitespace-nowrap text-xs text-slate-500" title="Poza listą „Do ZD” - pokryte stanem / otwartymi ZD albo reguła">
        poza ZD
      </span>
    );
  }
  const label = row.orderUnitLabel ?? "szt.";
  return (
    <span className="font-semibold text-slate-900" title={`${formatQtyPl(row.orderPieces)} szt po dostawie`}>
      {formatQtyPl(row.orderZdUnits)} {label}
    </span>
  );
}

function AlertsSection({
  rows,
  filter,
  emptyNoIncomingTotal,
  onFilterChange: setFilter,
  canMutate,
  onError,
}: {
  rows: StockWatchRowView[];
  filter: AlertFilter;
  emptyNoIncomingTotal: number;
  onFilterChange: (filter: AlertFilter) => void;
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  const emptyOnly = filter === "empty_no_incoming";
  const segmentValue: Exclude<AlertFilter, "empty_no_incoming"> =
    filter === "empty_no_incoming" ? "all" : filter;
  const visible = rows.filter((r) => matchesAlertFilter(r, filter));

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlertCircle size={26} strokeWidth={1.75} />}
          title="Brak krytycznych braków"
          description="Żaden aktywny towar nie skończy się w ciągu 48 h ani przed dostawą zamówienia złożonego dziś. Towary poniżej celu zapasu znajdziesz w zakładce „Do ZD po dostawcach”."
        />
      </Card>
    );
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="space-y-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-0.5 text-red-600" aria-hidden>
              <IconAlertCircle size={16} strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Do zamówienia dziś</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {emptyOnly
                  ? "Tylko dziury na półce: zero dostępnych i nic w otwartych ZD."
                  : "Brak, ≤ 48 h i „przed dostawą”. Przełącznik po prawej odcina towar, który już jedzie."}
              </p>
            </div>
          </div>
          <EmptyShelfSwitch
            checked={emptyOnly}
            count={emptyNoIncomingTotal}
            onChange={(on) => setFilter(on ? "empty_no_incoming" : "all")}
          />
        </div>
        <SegmentedControl
          value={segmentValue}
          onChange={setFilter}
          ariaLabel="Filtr alertów"
          density="compact"
          className="w-full"
          disabled={emptyOnly}
          options={[
            { value: "all", label: `Wszystkie (${rows.length})` },
            {
              value: "out_of_stock",
              label: "Brak",
              title: "Stan dostępny ≤ 0 (także z towarem w drodze)",
            },
            { value: "critical", label: "≤ 48 h" },
            { value: "before_delivery", label: "Przed dostawą" },
          ]}
        />
        {emptyOnly ? (
          <p className="text-[11px] leading-snug text-red-800/90" role="status">
            Widoczne:{" "}
            <strong className="tabular-nums">{visible.length}</strong>
            {emptyNoIncomingTotal > visible.length
              ? ` z ${emptyNoIncomingTotal} (lista pokazuje najpilniejsze)`
              : null}
            . Wyłącz przełącznik, żeby zobaczyć też braki z towarem w drodze.
          </p>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <EmptyState
            icon={<IconTruck size={26} strokeWidth={1.75} />}
            title={emptyOnly ? "Nie ma pustych półek bez dostawy" : "Brak pozycji w tym filtrze"}
            description={
              emptyOnly
                ? "Każdy brak ma już otwarte ZD albo nie ma braków w tej liście. Wyłącz przełącznik albo sprawdź „Do ZD po dostawcach”."
                : "Zmień filtr albo wyłącz przełącznik „Puste · bez dostawy”."
            }
            action={
              emptyOnly ? (
                <Button
                  variant="secondary"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => setFilter("all")}
                >
                  Pokaż wszystkie alerty
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 sm:hidden">
            {visible.map((row) => {
              const emptyShelf = isStockWatchEmptyNoIncoming(row);
              return (
                <li
                  key={row.subiektTwId}
                  className={cn(
                    "flex gap-3 px-4 py-3",
                    emptyShelf && "border-l-[3px] border-l-red-500 bg-red-50/30"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <ProductCell row={row} />
                    <p className="truncate text-xs font-medium text-slate-600">
                      {row.supplierName ?? "-"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <CoverChip row={row} />
                      {emptyShelf ? (
                        <span className="rounded bg-red-100/90 px-1.5 py-0.5 text-[11px] font-semibold text-red-800">
                          nic w drodze
                        </span>
                      ) : row.openZdQty > 0 ? (
                        <span className="tabular-nums text-indigo-700">
                          w drodze {formatQtyPl(row.openZdQty)}
                        </span>
                      ) : null}
                      <span className="tabular-nums">
                        {formatVelocity(row.velocityDaily)} szt/d
                      </span>
                      <span className="tabular-nums">
                        Do ZD: <OrderQty row={row} />
                      </span>
                    </div>
                  </div>
                  {canMutate ? (
                    <StockRuleMenu
                      subiektTwId={row.subiektTwId}
                      twSymbol={row.twSymbol}
                      twNazwa={row.twNazwa}
                      rule={row.rule}
                      onError={onError}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
          <TableScroll className="hidden sm:block sm:px-0 sm:pb-0">
            <DataTable className="min-w-[800px]">
              <thead>
                <tr>
                  <th scope="col">Towar</th>
                  <th scope="col">Starczy na</th>
                  <th
                    scope="col"
                    className="text-right"
                    title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD"
                  >
                    Rotacja
                  </th>
                  <th scope="col">Stan / cel zapasu</th>
                  <th
                    scope="col"
                    className="text-right"
                    title="Ilość z listy Kreatora ZD (jednostka dokumentu)"
                  >
                    Do ZD
                  </th>
                  <th
                    scope="col"
                    className="text-right"
                    title="Wartość dziennej sprzedaży: rotacja × ostatnia cena zakupu z ZD"
                  >
                    Sprzedaż zł / dzień
                  </th>
                  {canMutate ? (
                    <th scope="col">
                      <span className="sr-only">Reguła</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const emptyShelf = isStockWatchEmptyNoIncoming(row);
                  return (
                    <tr
                      key={row.subiektTwId}
                      className={cn(
                        emptyShelf && "bg-red-50/35 [&>td:first-child]:shadow-[inset_3px_0_0_0_#ef4444]"
                      )}
                    >
                      <td>
                        <ProductCell row={row} />
                        <p className="max-w-[16rem] truncate text-xs font-medium text-slate-600">
                          {row.supplierName ?? "-"}
                        </p>
                      </td>
                      <td>
                        <CoverChip row={row} />
                      </td>
                      <td>
                        <VelocityCell row={row} />
                      </td>
                      <td>
                        <StockCoverBar
                          available={row.availableQty}
                          incoming={row.openZdQty}
                          safetyStock={row.targetQty}
                          status={row.status}
                          detail={{
                            stock: row.stockQty,
                            reserved: row.reservedQty,
                            openZkUnreserved: row.openZkUnreservedQty,
                            minStock: row.minStockQty,
                          }}
                        />
                        {emptyShelf ? (
                          <p className="mt-0.5 text-[11px] font-medium text-red-700">
                            nic w drodze
                          </p>
                        ) : row.openZdQty > 0 ? (
                          <p className="mt-0.5 text-[11px] text-indigo-700">
                            w drodze {formatQtyPl(row.openZdQty)} szt (ZD)
                          </p>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums">
                        <OrderQty row={row} />
                      </td>
                      <td className="text-right tabular-nums text-sm">
                        {row.dailyValue != null ? (
                          formatPln(row.dailyValue)
                        ) : (
                          <span className="text-slate-500">brak ceny</span>
                        )}
                      </td>
                      {canMutate ? (
                        <td className="text-right">
                          <StockRuleMenu
                            subiektTwId={row.subiektTwId}
                            twSymbol={row.twSymbol}
                            twNazwa={row.twNazwa}
                            rule={row.rule}
                            onError={onError}
                          />
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableScroll>
        </>
      )}
    </Card>
  );
}

function SuppliersSection({
  proposals,
  canMutate,
  filtered,
}: {
  proposals: StockWatchSupplierProposal[];
  canMutate: boolean;
  filtered: boolean;
}) {
  if (proposals.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconTruck size={26} strokeWidth={1.75} />}
          title="Nic do zamówienia"
          description={
            filtered
              ? "Lista „Do ZD” tego dostawcy jest pusta. Usuń filtr, żeby zobaczyć pozostałych."
              : "Lista „Do ZD” jest pusta u wszystkich analizowanych dostawców."
          }
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="px-0.5 text-xs leading-relaxed text-slate-500">
        Liczone co noc tak samo jak „Policz” w Kreatorze ZD. Edycja i utworzenie dokumentu — tylko w
        Kreatorze.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {proposals.map((p) => (
          <SupplierProposalCard key={p.supplierId} proposal={p} canMutate={canMutate} />
        ))}
      </div>
    </div>
  );
}

function SupplierProposalCard({
  proposal: p,
  canMutate,
}: {
  proposal: StockWatchSupplierProposal;
  canMutate: boolean;
}) {
  const urgent = p.outOfStockCount + p.criticalCount;
  // „Do kolejnej dostawy” zmienia ilości tylko, gdy kolejne zamówienie + dostawa > zapas z karty.
  const { horizonExtends } = p;
  const hasDeliveryRisk = p.beforeDeliveryCount > 0 || p.beforeNextDeliveryCount > 0;
  // Nic Do ZD poza zagrożonymi przed dostawą — domyślny horyzont Kreatora by ich nie objął.
  const prepareWithHorizon = stockWatchPrepareZdUsesHorizon(p);
  return (
    <div id={`dostawca-${p.supplierId}`} className="flex scroll-mt-16">
    <Card
      padding={false}
      className="flex flex-1 flex-col p-4 transition-[border-color,box-shadow] duration-150 ease-out hover:border-slate-300 hover:shadow-[0_8px_24px_-18px_rgba(15,23,42,0.35)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
          {p.supplierName}
        </h3>
        {urgent > 0 ? (
          <Badge variant="danger" className="shrink-0">
            {urgent} {polishPluralWord(urgent, "pilna", "pilne", "pilnych")}
          </Badge>
        ) : (
          <Badge variant="default" className="shrink-0">
            uzupełnienie
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-700">
        Do ZD: <strong className="tabular-nums">{polishPozycjeLabel(p.lineCount)}</strong>
        {p.orderValue > 0 ? (
          <>
            , wartość ok. <strong className="tabular-nums text-slate-900">{formatPln(p.orderValue)}</strong>
          </>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-slate-500">
        Zapas {p.dniZapasu} dni · sprzedaż {p.dataOd} - {p.dataDo} · policzono {formatWhen(p.computedAt)}
      </p>
      {p.leadDays != null ? (
        <p className="mt-0.5 text-xs text-slate-500" title="Czas dostawy z historii dostaw (9 na 10 dostaw), kolejne zamówienie z harmonogramu">
          Dostawa ~{p.leadDays} d
          {p.leadSource === "default" ? " (założenie)" : ""} ·{" "}
          {p.nextOrderDate
            ? `kolejne zamówienie ${formatShortDate(p.nextOrderDate)} (${formatDaysAhead(daysFromToday(p.nextOrderDate) ?? p.nextOrderDays ?? 0)})`
            : "na żądanie"}
        </p>
      ) : null}
      {p.beforeDeliveryCount > 0 || p.beforeNextDeliveryCount > 0 ? (
        <p className="mt-1.5 text-xs leading-snug text-red-800">
          {p.beforeDeliveryCount > 0 ? (
            <strong>{p.beforeDeliveryCount} skończy się przed dostawą zamówienia złożonego dziś. </strong>
          ) : null}
          {p.beforeNextDeliveryCount > 0
            ? `${p.beforeNextDeliveryCount} przed dostawą z kolejnego zamówienia. `
            : ""}
          {horizonExtends
            ? `Zapas ${p.dniZapasu} d nie wystarczy do kolejnej dostawy (${stockWatchHorizonDays(p) ?? 0} d) - w Kreatorze zaznacz „Do kolejnej dostawy”.`
            : "Zapas z karty wystarcza do kolejnej dostawy - zamów dziś, nie czekaj na termin z planu."}
        </p>
      ) : null}
      {p.unpricedCount > 0 ? (
        <p className="mt-0.5 text-xs text-slate-500">
          {polishPozycjeLabel(p.unpricedCount)} bez ceny z ZD - poza wartością
        </p>
      ) : null}

      {p.mostUrgent ? (
        <p className="mt-2 truncate text-xs text-slate-600" title={p.mostUrgent.twNazwa}>
          Najpilniej: <span className="font-mono font-semibold">{p.mostUrgent.twSymbol ?? p.mostUrgent.twNazwa}</span>
          {" - "}
          {p.mostUrgent.daysOfCover == null
            ? "poniżej minimum"
            : p.mostUrgent.daysOfCover <= 0
              ? "brak"
              : `starczy na ${formatCover(p.mostUrgent.daysOfCover, "warning")}`}
        </p>
      ) : null}

      {p.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-xs text-amber-800">
          {p.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto space-y-1.5 pt-4">
        {canMutate ? (
          <>
            <Link
              href={buildZdEstimateLaunchHref(p.supplierId, prepareWithHorizon ? { leadTimeHorizon: true } : undefined)}
              className={cn(
                "inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md px-4 text-sm font-semibold transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 focus-visible:ring-offset-1 sm:h-9",
                buttonPrimaryClass
              )}
            >
              Przygotuj ZD
            </Link>
            {hasDeliveryRisk && horizonExtends && !prepareWithHorizon ? (
              <Link
                href={buildZdEstimateLaunchHref(p.supplierId, { leadTimeHorizon: true })}
                className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 transition-colors duration-150 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/45 active:scale-[0.98] sm:h-9"
                title="Otwiera Kreator z zaznaczoną opcją „Do kolejnej dostawy” — możesz ją odznaczyć"
              >
                Przygotuj ZD do kolejnej dostawy
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
    </div>
  );
}

function RotationSection({
  rows,
  canMutate,
  onError,
}: {
  rows: StockWatchRowView[];
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Najlepiej sprzedawane{" "}
          <span className="font-normal tabular-nums text-slate-400">({rows.length})</span>
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
          Pasek: stan względem celu zapasu (rotacja × dni zapasu). Kreska = 100% celu, kreskowanie = towar w
          drodze.
        </p>
      </div>
      <TableScroll className="sm:px-0 sm:pb-0">
        <DataTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col" className="w-10 text-right">#</th>
              <th scope="col">Towar</th>
              <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">Rotacja</th>
              <th scope="col">Stan / cel zapasu</th>
              <th scope="col">Starczy na</th>
              <th scope="col">Reguła</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.subiektTwId}>
                <td className="text-right text-xs font-semibold tabular-nums text-slate-400">{i + 1}</td>
                <td>
                  <ProductCell row={row} />
                  <p className="truncate text-xs text-slate-500">{row.supplierName}</p>
                </td>
                <td>
                  <VelocityCell row={row} />
                </td>
                <td>
                  <StockCoverBar
                    available={row.availableQty}
                    incoming={row.openZdQty}
                    safetyStock={row.targetQty}
                    status={row.status}
                    detail={{
                      stock: row.stockQty,
                      reserved: row.reservedQty,
                      openZkUnreserved: row.openZkUnreservedQty,
                      minStock: row.minStockQty,
                    }}
                  />
                  <p className="text-[11px] text-slate-500">cel na {row.salesPeriodDays} dni</p>
                </td>
                <td>
                  <CoverChip row={row} />
                </td>
                <td>
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("text-xs", row.rule === "standard" ? "text-slate-500" : "font-medium text-indigo-800")}>
                      {STOCK_WATCH_RULE_META[row.rule].label}
                    </span>
                    {canMutate ? (
                      <StockRuleMenu
                        subiektTwId={row.subiektTwId}
                        twSymbol={row.twSymbol}
                        twNazwa={row.twNazwa}
                        rule={row.rule}
                        onError={onError}
                      />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      </TableScroll>
    </Card>
  );
}

function RulesSection({
  flagged,
  canMutate,
  onError,
}: {
  flagged: StockWatchRowView[];
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<StockWatchRowView[] | null>(null);
  const [searching, startSearch] = useTransition();

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) return;
    const id = window.setTimeout(() => {
      startSearch(async () => {
        const res = await actionSearchStockWatchItems(q);
        if (!res.ok) {
          onError(res.message);
          return;
        }
        setResults(res.data);
      });
    }, 300);
    return () => window.clearTimeout(id);
  }, [term, onError]);

  const shown = term.trim().length >= 2 ? results : null;
  const groups = useMemo(
    () => ({
      on_request: flagged.filter((f) => f.rule === "on_request"),
      excluded: flagged.filter((f) => f.rule === "excluded"),
    }),
    [flagged]
  );

  return (
    <div className="space-y-4">
      <Card padding={false} className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Reguły towarów</h2>
            <p className="mt-0.5 max-w-xl text-xs text-slate-500">
              Te same flagi co w kreatorze ZD - zmiana działa w obu miejscach od razu.{" "}
              <strong>Standard</strong>: pełny automat. <strong>Na prośbę</strong>: tylko pod klienta, bez zapasu.{" "}
              <strong>Wyklucz</strong>: ignorowany, bez alertów.
            </p>
          </div>
          <label className="relative block sm:w-80">
            <span className="sr-only">Szukaj towaru</span>
            <IconSearch
              size={16}
              strokeWidth={2}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Symbol albo nazwa (min. 2 znaki)"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm outline-none ring-indigo-200 focus:border-indigo-300 focus:ring-2"
            />
            {searching ? <Spinner size="sm" className="absolute right-2.5 top-1/2 -translate-y-1/2" /> : null}
          </label>
        </div>
        {shown ? (
          <div className="mt-4">
            {shown.length === 0 ? (
              <p className="text-sm text-slate-500">Brak towarów w analizie dla „{term.trim()}”.</p>
            ) : (
              <RuleTable rows={shown} canMutate={canMutate} onError={onError} />
            )}
          </div>
        ) : null}
      </Card>

      {(["on_request", "excluded"] as const).map((rule) => (
        <Card key={rule} padding={false} className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {STOCK_WATCH_RULE_META[rule].label}{" "}
                <span className="font-normal tabular-nums text-slate-400">({groups[rule].length})</span>
              </h3>
              <p className="text-xs text-slate-500">{STOCK_WATCH_RULE_META[rule].description}</p>
            </div>
            <IconSettings size={16} className="text-slate-300" />
          </div>
          {groups[rule].length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500 sm:px-5">Brak towarów z tą regułą w analizowanych zakresach.</p>
          ) : (
            <RuleTable rows={groups[rule]} canMutate={canMutate} onError={onError} />
          )}
        </Card>
      ))}
    </div>
  );
}

function RuleTable({
  rows,
  canMutate,
  onError,
}: {
  rows: StockWatchRowView[];
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  return (
    <TableScroll className="sm:px-0 sm:pb-0">
      <DataTable className="min-w-[680px]">
        <thead>
          <tr>
            <th scope="col">Towar</th>
            <th scope="col">Dostawca</th>
            <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">Rotacja</th>
            <th scope="col">Starczy na</th>
            <th scope="col">Reguła</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.subiektTwId}>
              <td>
                <ProductCell row={row} />
                {row.ruleNote ? <p className="max-w-[16rem] truncate text-[11px] italic text-slate-500">„{row.ruleNote}”</p> : null}
              </td>
              <td className="max-w-[10rem] truncate text-sm text-slate-700">{row.supplierName ?? "-"}</td>
              <td>
                <VelocityCell row={row} />
              </td>
              <td>
                <CoverChip row={row} />
              </td>
              <td>
                {canMutate ? (
                  <StockRuleControl
                    subiektTwId={row.subiektTwId}
                    twSymbol={row.twSymbol}
                    twNazwa={row.twNazwa}
                    rule={row.rule}
                    onError={onError}
                  />
                ) : (
                  <span className="text-xs text-slate-600">{STOCK_WATCH_RULE_META[row.rule].label}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </TableScroll>
  );
}
