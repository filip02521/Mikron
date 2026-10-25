"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { BrandLoader } from "@/components/ui/BrandLoader";
import { Spinner } from "@/components/ui/Spinner";
import {
  IconAlertCircle,
  IconChartTrend,
  IconSearch,
  IconTruck,
} from "@/components/icons/StrokeIcons";
import {
  actionSearchStockWatchItems,
  actionStartStockWatchRun,
} from "@/app/actions/stock-watch";
import { polishPluralWord, polishPozycjeLabel } from "@/lib/email/polish-plural";
import {
  buttonPrimaryClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import type { StockWatchDashboard, StockWatchRowView } from "@/lib/stock-watch/dashboard";
import { isStockWatchEmptyNoIncoming } from "@/lib/stock-watch/analysis";
import { StockSupplierBoard } from "@/components/stock-watch/StockSupplierBoard";
import {
  AssemblyTag,
  CoverChip,
  formatWhen,
  IncomingTag,
  OrderQty,
  ProductCell,
  VelocityCell,
} from "@/components/stock-watch/StockWatchCells";
import { buildStockWatchStatusLine } from "@/lib/stock-watch/status-line";
import { StockCoverBar } from "@/components/stock-watch/StockCoverBar";
import { StockRuleControl, StockRuleMenu } from "@/components/stock-watch/StockRuleControl";
import {
  formatPln,
  formatQtyPl,
  formatVelocity,
  STOCK_WATCH_RULE_META,
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
  failures: { supplierId: string; supplierName: string; message: string }[];
};

type TabId = "alerts" | "suppliers" | "assembly" | "rotation" | "rules";
const TAB_IDS: readonly TabId[] = ["suppliers", "alerts", "assembly", "rotation", "rules"];
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
  /** `?tab=alerts|suppliers|assembly|rotation|rules` */
  initialTab?: string | null;
  /** `?filtr=puste` — same produkty bez stanu i bez otwartego ZD. */
  initialAlertFilter?: string | null;
}) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(initialSupplierId);
  const parsedFilter = parseAlertFilterParam(initialAlertFilter);
  const [tab, setTab] = useState<TabId>(() => {
    if (isTabId(initialTab)) return initialTab;
    // Domyślnie tablica dostawców; `?filtr=` dotyczy listy wszystkich braków.
    return parsedFilter ? "alerts" : "suppliers";
  });
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(() => parsedFilter ?? "all");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [starting, startRun] = useTransition();

  const running = run?.status === "running";
  // Z kiedy są dane dostawców, których ten przebieg nie przeliczył (najstarsze) — chip pokazuje datę przebiegu.
  const dataAsOf = useMemo(() => {
    const failed = new Set(run?.failures.map((f) => f.supplierId) ?? []);
    return dashboard.proposals
      .filter((p) => failed.has(p.supplierId))
      .reduce<string | null>((min, p) => (!min || p.computedAt < min ? p.computedAt : min), null);
  }, [dashboard.proposals, run]);

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
  const assemblyRows = useMemo(
    () => (supplierId ? dashboard.assembly.filter((r) => r.supplierId === supplierId) : dashboard.assembly),
    [dashboard.assembly, supplierId]
  );
  const boardRows = useMemo(
    () =>
      supplierId ? dashboard.suppliers.filter((s) => s.supplierId === supplierId) : dashboard.suppliers,
    [dashboard.suppliers, supplierId]
  );
  const supplierName = supplierId
    ? (dashboard.suppliers.find((s) => s.supplierId === supplierId)?.supplierName ??
      dashboard.proposals.find((p) => p.supplierId === supplierId)?.supplierName ??
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
    // Tablica dostawców jest domyślna; lista braków z filtrem otwiera się sama po `filtr=`.
    const listFilter = nextTab === "alerts" ? filter : "all";
    if (nextTab !== "suppliers" && !(nextTab === "alerts" && listFilter !== "all")) params.set("tab", nextTab);
    if (listFilter === "empty_no_incoming") params.set("filtr", "puste");
    else if (listFilter !== "all") params.set("filtr", listFilter);
    const qs = params.toString();
    router.replace(qs ? `/zakupy/braki?${qs}` : "/zakupy/braki", { scroll: false });
  };

  /** „Lista braków dostawcy” z tablicy — stan zmieniany tutaj, bo strona nie remontuje panelu przy tym samym `dostawca`. */
  const openSupplierList = (id: string) => {
    setSupplierId(id);
    setAlertFilter("all");
    setTab("alerts");
    syncBrakiUrl({ supplierId: id, filter: "all", tab: "alerts" });
  };

  const clearSupplier = () => {
    setSupplierId(null);
    syncBrakiUrl({ supplierId: null });
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
    { id: "suppliers", label: "Dostawcy", count: boardRows.length },
    { id: "alerts", label: "Wszystkie braki", count: alerts.length, tone: "danger" },
    { id: "assembly", label: "Kompletacja", count: assemblyRows.length },
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
          title={`Nie przeliczono ${run.failures.length === run.scopesTotal ? "żadnego dostawcy" : `${run.failures.length} ${polishPluralWord(run.failures.length, "dostawcy", "dostawców", "dostawców")}`} — ich listy pochodzą z ostatniego udanego przeliczenia${dataAsOf ? ` (${formatWhen(dataAsOf)})` : ""}.`}
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
            <StatusPanel dashboard={dashboard} canMutate={canMutate} />
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
            className="sticky top-0 z-10 flex gap-5 overflow-x-auto border-b border-slate-200 bg-[var(--background)]/90 backdrop-blur-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-6 [&::-webkit-scrollbar]:hidden"
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
                    "-mb-px inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 border-b-2 px-0.5 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600 sm:min-h-10",
                    active
                      ? "border-indigo-600 text-slate-900"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  )}
                >
                  {t.label}
                  {t.count != null && t.count > 0 ? (
                    <span
                      className={cn(
                        "inline-flex min-w-[1.25rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums",
                        t.tone === "danger" ? "bg-red-50 text-red-800" : "bg-slate-100 text-slate-600"
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
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 py-0.5 pl-2.5 pr-0.5 text-xs font-medium text-indigo-900 ring-1 ring-inset ring-indigo-200">
                Dostawca: {supplierName}
                <button
                  type="button"
                  onClick={clearSupplier}
                  className="inline-flex size-10 cursor-pointer items-center justify-center rounded text-indigo-700 transition-colors hover:bg-white hover:text-indigo-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 sm:size-7"
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
              <StockSupplierBoard
                rows={boardRows}
                quietSupplierCount={supplierId ? 0 : dashboard.quietSupplierCount}
                canMutate={canMutate}
                onError={setError}
                initialExpandedId={supplierId}
                filtered={supplierId != null}
                onOpenList={openSupplierList}
              />
            ) : tab === "assembly" ? (
              <AssemblySection rows={assemblyRows} canMutate={canMutate} onError={setError} />
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

function StatusPanel({
  dashboard,
  canMutate,
}: {
  dashboard: StockWatchDashboard;
  canMutate: boolean;
}) {
  const { totals, health, proposals, counts } = dashboard;
  // Tylko dostawcy z czymś na liście — propozycje z samym ryzykiem albo ostrzeżeniem mają 0 pozycji.
  const suppliersWithLines = proposals.filter((p) => p.lineCount > 0).length;
  const line = buildStockWatchStatusLine(dashboard);
  const dot =
    line.tone === "danger" ? "bg-red-600" : line.tone === "warning" ? "bg-amber-500" : "bg-emerald-600";
  return (
    <Card padding={false}>
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <div className="min-w-0" role="status">
          <p className="flex items-start gap-2.5 text-lg font-semibold leading-snug tracking-[-0.015em] text-slate-900 text-balance">
            <span className={cn("mt-2 size-2.5 shrink-0 rounded-full", dot)} aria-hidden />
            {line.headline}
          </p>
          <p className="mt-1 pl-5 text-sm leading-relaxed text-slate-600 tabular-nums">
            {line.urgentSuppliers > 0
              ? `${line.urgentSuppliers} ${polishPluralWord(line.urgentSuppliers, "dostawca wymaga", "dostawcy wymagają", "dostawców wymaga")} zamówienia dziś. `
              : null}
            {totals.proposalLines > 0
              ? `Na listach „Do ZD”: ${polishPozycjeLabel(totals.proposalLines)} u ${suppliersWithLines} ${polishPluralWord(suppliersWithLines, "dostawcy", "dostawców", "dostawców")}, ok. ${formatPln(totals.proposalValue)} netto. `
              : "Listy „Do ZD” są puste. "}
            <span className="text-slate-500">
              W normie {health.score}% towarów ze sprzedażą
              {counts.noSales > 0 ? ` · ${counts.noSales} bez sprzedaży` : ""}
              {counts.toAssemble > 0
                ? ` · ${counts.toAssemble} do kompletacji w Subiekcie (bez zamawiania)`
                : ""}
              .
            </span>
          </p>
        </div>
        {line.focus && canMutate ? (
          <div className="flex shrink-0 flex-col gap-1 pl-5 sm:items-end sm:pl-0">
            <Link
              href={line.focus.href}
              className={cn(
                "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-sm font-medium sm:min-h-10 transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1",
                buttonPrimaryClass
              )}
            >
              Przygotuj ZD: {line.focus.supplierName}
            </Link>
            <span className="text-xs text-slate-500">Pierwszy na liście priorytetów</span>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/** Chip filtra: same produkty bez stanu i bez otwartego ZD. */
function EmptyShelfChip({
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
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        panelChoiceChipClass,
        "inline-flex min-h-10 cursor-pointer items-center gap-1.5 py-1.5 sm:min-h-8",
        checked ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass
      )}
      title="Pokaż tylko towary bez stanu dostępnego i bez sztuk na otwartych ZD"
    >
      Puste · bez dostawy
      {count > 0 ? (
        <span
          className={cn(
            "rounded px-1 text-[0.6875rem] font-semibold tabular-nums",
            checked ? "bg-white text-indigo-700" : "text-slate-500"
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
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
          description="Żaden aktywny towar nie skończy się w ciągu 48 h ani przed dostawą zamówienia złożonego dziś. Towary poniżej celu zapasu znajdziesz w zakładce „Dostawcy”."
        />
      </Card>
    );
  }

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="space-y-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">Do zamówienia dziś</h2>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            {emptyOnly
              ? "Tylko dziury na półce: zero dostępnych i nic w otwartych ZD."
              : "Brak, ≤ 48 h i „przed dostawą”. Filtr „Puste · bez dostawy” odcina towar, który już jedzie."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl
            value={segmentValue}
            onChange={setFilter}
            ariaLabel="Filtr alertów"
            density="compact"
            disabled={emptyOnly}
            options={[
              { value: "all", label: `Wszystkie ${rows.length}` },
              {
                value: "out_of_stock",
                label: "Brak",
                title: "Stan dostępny ≤ 0 (także z towarem w drodze)",
              },
              { value: "critical", label: "≤ 48 h" },
              { value: "before_delivery", label: "Przed dostawą" },
            ]}
          />
          <EmptyShelfChip
            checked={emptyOnly}
            count={emptyNoIncomingTotal}
            onChange={(on) => setFilter(on ? "empty_no_incoming" : "all")}
          />
          <span className="ml-auto text-[0.6875rem] tabular-nums text-slate-500" role="status">
            {polishPozycjeLabel(visible.length)}
            {emptyOnly && emptyNoIncomingTotal > visible.length
              ? ` z ${emptyNoIncomingTotal} (najpilniejsze)`
              : null}
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <EmptyState
            icon={<IconTruck size={26} strokeWidth={1.75} />}
            title={emptyOnly ? "Nie ma pustych półek bez dostawy" : "Brak pozycji w tym filtrze"}
            description={
              emptyOnly
                ? "Każdy brak ma już otwarte ZD albo nie ma braków w tej liście. Wyłącz filtr albo sprawdź zakładkę „Dostawcy”."
                : "Zmień filtr albo wyłącz „Puste · bez dostawy”."
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
                  key={`${row.supplierId}:${row.subiektTwId}`}
                  className={cn("flex gap-3 px-4 py-3", emptyShelf && "bg-red-50/50")}
                >
                  <div className="min-w-0 flex-1">
                    <ProductCell row={row} />
                    <p className="max-w-[16rem] truncate text-xs font-medium text-slate-600">{row.supplierName ?? "-"}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <CoverChip row={row} />
                      <IncomingTag row={row} />
                      <span className="tabular-nums">{formatVelocity(row.velocityDaily)} szt/d</span>
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
            <DataTable className="kpi-table min-w-[760px]">
              <thead>
                <tr>
                  <th scope="col">Towar</th>
                  <th scope="col">Starczy na</th>
                  <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">
                    Rotacja
                  </th>
                  <th scope="col">Stan / cel zapasu</th>
                  <th scope="col" className="text-right" title="Ilość z listy Kreatora ZD (jednostka dokumentu)">
                    Do ZD
                  </th>
                  <th
                    scope="col"
                    className="text-right"
                    title="Wartość dziennej sprzedaży: rotacja × ostatnia cena zakupu z ZD"
                  >
                    zł / dzień
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
                      key={`${row.supplierId}:${row.subiektTwId}`}
                      className={cn(emptyShelf && "bg-red-50/50")}
                    >
                      <td>
                        <ProductCell row={row} />
                        <p className="max-w-[16rem] truncate text-xs font-medium text-slate-600">{row.supplierName ?? "-"}</p>
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
                        <div className="mt-1">
                          <IncomingTag row={row} />
                        </div>
                      </td>
                      <td className="text-right tabular-nums">
                        <OrderQty row={row} />
                      </td>
                      <td className="text-right tabular-nums text-sm">
                        {row.dailyValue != null ? formatPln(row.dailyValue) : <span className="text-slate-500">brak ceny</span>}
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

/** Zestawy do złożenia z części / składniki do wyjęcia z kompletu — dokument w Subiekcie, nie ZD. */
function AssemblySection({
  rows,
  canMutate,
  onError,
}: {
  rows: StockWatchRowView[];
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconAlertCircle size={26} strokeWidth={1.75} />}
          title="Nic do kompletacji"
          description="Żaden zestaw ze składów Kreatora ZD nie czeka na złożenie z części ani na rozłożenie kompletu."
        />
      </Card>
    );
  }
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
          Do kompletacji w Subiekcie{" "}
          <span className="font-normal tabular-nums text-slate-500">({rows.length})</span>
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
          Własny stan karty pusty albo na wyczerpaniu, ale części (albo komplety) leżą na magazynie. Zrób
          dokument kompletacji - nie zamawiaj. Składy ustawiasz w Kreatorze ZD.
        </p>
      </div>
      <TableScroll className="sm:px-0 sm:pb-0">
        <DataTable className="kpi-table min-w-[720px]">
          <thead>
            <tr>
              <th scope="col">Towar</th>
              <th scope="col" className="text-right" title="Dostępne na karcie (stan - rezerwacje)">
                Stan karty
              </th>
              <th scope="col">Kompletacja</th>
              <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">
                Rotacja
              </th>
              <th scope="col" title="Po kompletacji">Starczy na</th>
              {canMutate ? (
                <th scope="col">
                  <span className="sr-only">Reguła</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.supplierId}:${row.subiektTwId}`}>
                <td>
                  <ProductCell row={row} />
                  <p className="max-w-[16rem] truncate text-xs font-medium text-slate-600">{row.supplierName ?? "-"}</p>
                </td>
                <td className="text-right tabular-nums text-sm font-semibold text-slate-900">
                  {formatQtyPl(row.availableQty)}
                </td>
                <td>
                  <AssemblyTag row={row} />
                  {row.assemblyNote ? (
                    <p className="mt-0.5 max-w-[22rem] truncate text-[0.6875rem] text-slate-500" title={row.assemblyNote}>
                      {row.assemblyNote}
                    </p>
                  ) : null}
                </td>
                <td>
                  <VelocityCell row={row} />
                </td>
                <td>
                  <CoverChip row={{ ...row, assemblyKind: null }} />
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
            ))}
          </tbody>
        </DataTable>
      </TableScroll>
    </Card>
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
        <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
          Najlepiej sprzedawane{" "}
          <span className="font-normal tabular-nums text-slate-500">({rows.length})</span>
        </h2>
        <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
          Pasek: stan względem celu zapasu (rotacja × dni zapasu). Kreska = 100% celu, kreskowanie = towar w
          drodze.
        </p>
      </div>
      <TableScroll className="sm:px-0 sm:pb-0">
        <DataTable className="kpi-table min-w-[720px]">
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
                <td className="text-right text-xs font-medium tabular-nums text-slate-500">{i + 1}</td>
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
                  <p className="text-[0.6875rem] text-slate-500">cel na {row.salesPeriodDays} dni</p>
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
            <h2 className="text-base font-semibold tracking-[-0.01em] text-slate-900">Reguły towarów</h2>
            <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-slate-600">
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
              className="h-11 w-full rounded-md border border-slate-200 bg-white pl-8 pr-9 text-base text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm"
            />
            {searching ? (
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <BrandLoader size="sm" label="Szukam towarów" />
              </span>
            ) : null}
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
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-base font-semibold tracking-[-0.01em] text-slate-900">
                {STOCK_WATCH_RULE_META[rule].label}{" "}
                <span className="font-normal tabular-nums text-slate-500">({groups[rule].length})</span>
              </h3>
              <p className="mt-0.5 text-sm text-slate-600">{STOCK_WATCH_RULE_META[rule].description}</p>
            </div>
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
                {row.ruleNote ? <p className="max-w-[16rem] truncate text-[0.6875rem] italic text-slate-500">„{row.ruleNote}”</p> : null}
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
