"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import type {
  StockWatchDashboard,
  StockWatchRowView,
  StockWatchSupplierProposal,
} from "@/lib/stock-watch/dashboard";
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
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : dateTimeFormatter.format(d);
}

export function StockWatchPanel({
  dashboard,
  run,
  canMutate,
  coverage,
}: {
  dashboard: StockWatchDashboard;
  run: StockWatchRunSummary | null;
  canMutate: boolean;
  /** Aktywni dostawcy vs z zakresem w kreatorze ZD (tylko ci są analizowani). */
  coverage: { active: number; mapped: number };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>(dashboard.alerts.length > 0 ? "alerts" : "suppliers");
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
        setError(res.message);
        return;
      }
      setNotice("Analiza uruchomiona w tle — wyniki odświeżą się same (zwykle kilka minut).");
      window.setTimeout(() => router.refresh(), 1500);
    });
  };

  const tabs: { id: TabId; label: string; count?: number; tone?: "danger" | "warning" }[] = [
    {
      id: "alerts",
      label: "Krytyczne",
      count: dashboard.alerts.length,
      tone: "danger",
    },
    { id: "suppliers", label: "Do ZD po dostawcach", count: dashboard.proposals.length },
    { id: "rotation", label: "Rotacja — Top 20" },
    { id: "rules", label: "Reguły", count: dashboard.flagged.length },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Braki i zamówienia"
        description="Co się kończy, zanim się skończy. Lista „Do ZD” liczona co noc tym samym silnikiem co Kreator ZD — „Przygotuj ZD” otwiera Kreator z tą listą."
        actions={
          <>
            <RunStatusChip run={run} />
            {canMutate ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={onStartRun}
                disabled={starting || running}
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
        <Alert tone="error" title="Nie udało się">
          {error}
        </Alert>
      ) : null}
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {run && run.failures.length > 0 ? (
        <Alert tone="warning" title={`Nie przeliczono ${run.failures.length} dostawców`}>
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
                <Button onClick={onStartRun} disabled={starting}>
                  Uruchom analizę
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <OverviewBand dashboard={dashboard} onJump={setTab} />
          {coverage.active > coverage.mapped ? (
            <p className="-mt-2 px-1 text-xs text-slate-500">
              Analiza obejmuje <strong className="text-slate-700">{coverage.mapped}</strong> z{" "}
              {coverage.active} aktywnych dostawców.{" "}
              {coverage.active - coverage.mapped} bez przypisanej grupy/cechy —{" "}
              <Link href="/zakupy/szacunek" className="font-medium text-indigo-700 hover:text-indigo-900">
                ustaw zakresy w Kreatorze ZD
              </Link>{" "}
              (menu Dostawcy → Zakresy), żeby ich towary trafiły do panelu.
            </p>
          ) : null}

          <nav
            role="tablist"
            aria-label="Sekcje panelu braków"
            className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto rounded-md border border-slate-200/80 bg-white/90 p-1 shadow-sm backdrop-blur"
          >
            {tabs.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`stock-watch-tab-${t.id}`}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {t.label}
                  {t.count ? (
                    <span
                      className={cn(
                        "min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums",
                        active
                          ? "bg-white/20 text-white"
                          : t.tone === "danger"
                            ? "bg-red-100 text-red-800"
                            : t.tone === "warning"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {t.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <section id={`stock-watch-tab-${tab}`} role="tabpanel" aria-label={tabs.find((t) => t.id === tab)?.label}>
            {tab === "alerts" ? (
              <AlertsSection rows={dashboard.alerts} canMutate={canMutate} onError={setError} />
            ) : tab === "suppliers" ? (
              <SuppliersSection proposals={dashboard.proposals} canMutate={canMutate} />
            ) : tab === "rotation" ? (
              <RotationSection rows={dashboard.topVelocity} />
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
    return <span className="text-xs text-slate-500">Analiza jeszcze nie działała</span>;
  }
  const tone =
    run.status === "ok"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
      : run.status === "running"
        ? "bg-indigo-50 text-indigo-800 ring-indigo-200"
        : run.status === "partial"
          ? "bg-amber-50 text-amber-900 ring-amber-200"
          : "bg-red-50 text-red-800 ring-red-200";
  const label =
    run.status === "running"
      ? `Liczę: ${run.scopesDone}/${run.scopesTotal} dostawców`
      : `Analiza ${formatWhen(run.finishedAt ?? run.heartbeatAt)}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tone
      )}
      title={`Sprzedaż do ${run.salesEndDate} · dostawcy ${run.scopesDone}/${run.scopesTotal}`}
    >
      <span className={cn("size-1.5 rounded-full", run.status === "running" ? "animate-pulse bg-indigo-500" : "bg-current opacity-70")} />
      {label}
    </span>
  );
}

function OverviewBand({
  dashboard,
  onJump,
}: {
  dashboard: StockWatchDashboard;
  onJump: (tab: TabId) => void;
}) {
  const { counts, totals, health } = dashboard;
  return (
    <Card padding={false} className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="flex shrink-0 justify-center md:w-48 md:border-r md:border-slate-100 md:pr-5">
          <StockHealthGauge score={health.score} active={health.active} ok={health.ok} />
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2.5 lg:grid-cols-5">
          <PanelSummaryMetric
            label="Brak towaru"
            value={counts.outOfStock}
            hint="Stan dostępny ≤ 0, towar rotuje"
            tone={counts.outOfStock > 0 ? "danger" : "success"}
            onClick={() => onJump("alerts")}
          />
          <PanelSummaryMetric
            label="Skończy się ≤ 48 h"
            value={counts.critical}
            hint="Przy obecnym tempie sprzedaży"
            tone={counts.critical > 0 ? "danger" : "success"}
            onClick={() => onJump("alerts")}
          />
          <PanelSummaryMetric
            label="Przed dostawą"
            value={counts.beforeDelivery}
            hint="Jeszcze jest, ale skończy się, zanim przyjedzie zamówienie złożone dziś"
            tone={counts.beforeDelivery > 0 ? "danger" : "success"}
            onClick={() => onJump("alerts")}
          />
          <PanelSummaryMetric
            label="Poniżej celu"
            value={counts.warning}
            hint="Z otwartymi ZD nadal poniżej celu zapasu"
            tone={counts.warning > 0 ? "warning" : "success"}
            onClick={() => onJump("suppliers")}
          />
          <PanelSummaryMetric
            label="Do ZD"
            value={formatPln(totals.proposalValue)}
            hint={`${totals.proposalLines} pozycji u ${dashboard.proposals.length} dostawców`}
            onClick={() => onJump("suppliers")}
          />
        </div>
      </div>
      <StatusDistribution counts={counts} />
    </Card>
  );
}

/** Pasek rozkładu statusów aktywnych SKU (Standard). */
function StatusDistribution({ counts }: { counts: StockWatchDashboard["counts"] }) {
  const parts = [
    { key: "out_of_stock" as const, n: counts.outOfStock },
    { key: "critical" as const, n: counts.critical },
    { key: "warning" as const, n: counts.warning },
    { key: "ok" as const, n: counts.ok },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  if (total === 0) return null;
  return (
    <div className="mt-4 border-t border-slate-100 pt-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
        {parts.map((p) =>
          p.n > 0 ? (
            <div
              key={p.key}
              className={STOCK_WATCH_STATUS_META[p.key].bar}
              style={{ width: `${(p.n / total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        {parts.map((p) => (
          <li key={p.key} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", STOCK_WATCH_STATUS_META[p.key].dot)} />
            {STOCK_WATCH_STATUS_META[p.key].label}
            <span className="font-semibold tabular-nums text-slate-800">{p.n}</span>
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5 text-slate-500">
          <span className="size-2 rounded-full bg-slate-300" />
          Bez sprzedaży {counts.noSales}
        </li>
      </ul>
    </div>
  );
}

function ProductCell({ row }: { row: Pick<StockWatchRowView, "twSymbol" | "twNazwa" | "grtNazwa"> }) {
  return (
    <div className="min-w-0 max-w-[16rem]">
      <p className="truncate font-mono text-[13px] font-semibold text-slate-900" title={row.twSymbol ?? undefined}>
        {row.twSymbol ?? "—"}
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
        <span className="text-[11px] text-slate-500">koniec ok. {runOut}</span>
      ) : null}
      {row.deliveryRisk ? <DeliveryRiskTag risk={row.deliveryRisk} /> : null}
    </div>
  );
}

function DeliveryRiskTag({ risk }: { risk: NonNullable<StockWatchRowView["deliveryRisk"]> }) {
  return risk === "before_delivery" ? (
    <span
      className="whitespace-nowrap rounded bg-red-50 px-1.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"
      title="Przy obecnym tempie sprzedaży (z towarem w drodze) skończy się, zanim przyjedzie zamówienie złożone dziś."
    >
      przed dostawą
    </span>
  ) : (
    <span
      className="whitespace-nowrap rounded bg-amber-50 px-1.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-200"
      title="Skończy się przed dostawą z kolejnego planowego zamówienia — warto zamówić wcześniej."
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
      <span className="whitespace-nowrap text-xs text-slate-500" title="Poza listą „Do ZD” — pokryte stanem / otwartymi ZD albo reguła">
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
  canMutate,
  onError,
}: {
  rows: StockWatchRowView[];
  canMutate: boolean;
  onError: (message: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "out_of_stock" | "critical" | "before_delivery">("all");
  const visible = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "before_delivery"
        ? r.deliveryRisk === "before_delivery"
        : r.status === filter
  );
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
    <Card padding={false} className="overflow-hidden border-red-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50/60 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-red-600 text-white">
            <IconAlertCircle size={18} strokeWidth={2} />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-red-950">Czerwona strefa</h2>
            <p className="text-xs text-red-900/70">
              Brak, ≤ 48 h i „przed dostawą” (skończy się, zanim przyjedzie zamówienie złożone dziś).
            </p>
          </div>
        </div>
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          ariaLabel="Filtr alertów"
          density="compact"
          options={[
            { value: "all", label: `Wszystkie (${rows.length})` },
            { value: "out_of_stock", label: "Brak" },
            { value: "critical", label: "≤ 48 h" },
            { value: "before_delivery", label: "Przed dostawą" },
          ]}
        />
      </div>
      {/* Telefon: karty zamiast szerokiej tabeli. */}
      <ul className="divide-y divide-red-100 sm:hidden">
        {visible.map((row) => (
          <li key={row.subiektTwId} className="flex gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <ProductCell row={row} />
              <p className="truncate text-[11px] font-medium text-slate-600">{row.supplierName ?? "—"}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                <CoverChip row={row} />
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
        ))}
      </ul>
      <TableScroll className="hidden sm:block sm:px-0 sm:pb-0">
        <DataTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col">Towar</th>
              <th scope="col">Starczy na</th>
              <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">Rotacja</th>
              <th scope="col">Stan vs cel</th>
              <th scope="col" className="text-right" title="Ilość z listy Kreatora ZD (jednostka dokumentu)">Do ZD</th>
              <th scope="col" className="text-right" title="Wartość dziennej sprzedaży: rotacja × ostatnia cena zakupu z ZD">
                Zł / dzień
              </th>
              {canMutate ? (
                <th scope="col">
                  <span className="sr-only">Reguła</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.subiektTwId} className={row.status === "out_of_stock" ? "bg-red-50/40" : undefined}>
                <td>
                  <ProductCell row={row} />
                  <p className="max-w-[16rem] truncate text-[11px] font-medium text-slate-600">{row.supplierName ?? "—"}</p>
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
                  />
                  {row.openZdQty > 0 ? (
                    <p className="text-[11px] text-indigo-700">w drodze {formatQtyPl(row.openZdQty)} szt (ZD)</p>
                  ) : null}
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
            ))}
          </tbody>
        </DataTable>
      </TableScroll>
    </Card>
  );
}

function SuppliersSection({
  proposals,
  canMutate,
}: {
  proposals: StockWatchSupplierProposal[];
  canMutate: boolean;
}) {
  if (proposals.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconTruck size={26} strokeWidth={1.75} />}
          title="Nic do zamówienia"
          description="Lista „Do ZD” jest pusta u wszystkich analizowanych dostawców."
        />
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      <p className="px-1 text-xs text-slate-500">
        Liczone co noc tak samo jak „Policz” w Kreatorze ZD (dni zapasu dostawcy, reguły, historia, prośby,
        opakowania). Edycja i utworzenie ZD — tylko w Kreatorze.
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
  // Opcja „Do kolejnej dostawy” zmienia ilości tylko, gdy dni do kolejnego
  // zamówienia + dostawa przekraczają zapas z karty (inaczej lista już wystarcza).
  const horizonExtends =
    p.leadDays != null && p.nextOrderDays != null && p.nextOrderDays + p.leadDays > p.dniZapasu;
  const hasDeliveryRisk = p.beforeDeliveryCount > 0 || p.beforeNextDeliveryCount > 0;
  return (
    <Card
      padding={false}
      className={cn(
        "flex flex-col p-4 transition-shadow hover:shadow-md",
        urgent > 0 && "border-red-200/80"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-[15px] font-semibold leading-snug text-slate-900">{p.supplierName}</h3>
        {urgent > 0 ? (
          <Badge variant="danger" className="shrink-0">
            {urgent} pilne
          </Badge>
        ) : (
          <Badge variant="warning" className="shrink-0">
            uzupełnienie
          </Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-700">
        Do ZD: <strong className="tabular-nums">{p.lineCount} {p.lineCount === 1 ? "pozycja" : "pozycji"}</strong>
        {p.orderValue > 0 ? (
          <>
            , wartość ok. <strong className="tabular-nums text-slate-900">{formatPln(p.orderValue)}</strong>
          </>
        ) : null}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Zapas {p.dniZapasu} dni · sprzedaż {p.dataOd} – {p.dataDo} · policzono {formatWhen(p.computedAt)}
      </p>
      {p.leadDays != null ? (
        <p className="mt-0.5 text-[11px] text-slate-500" title="Czas dostawy z historii dostaw (9 na 10 dostaw), kolejne zamówienie z harmonogramu">
          Dostawa ~{p.leadDays} d
          {p.leadSource === "default" ? " (założenie)" : ""} ·{" "}
          {p.nextOrderDate
            ? `kolejne zamówienie ${formatShortDate(p.nextOrderDate)} (za ${p.nextOrderDays} d)`
            : "na żądanie"}
        </p>
      ) : null}
      {p.beforeDeliveryCount > 0 || p.beforeNextDeliveryCount > 0 ? (
        <p className="mt-1.5 rounded-md bg-red-50/70 px-2 py-1 text-[11px] leading-snug text-red-900">
          {p.beforeDeliveryCount > 0 ? (
            <strong>{p.beforeDeliveryCount} skończy się przed dostawą zamówienia złożonego dziś. </strong>
          ) : null}
          {p.beforeNextDeliveryCount > 0
            ? `${p.beforeNextDeliveryCount} przed dostawą z kolejnego zamówienia. `
            : ""}
          {horizonExtends
            ? `Zapas ${p.dniZapasu} d nie wystarczy do kolejnej dostawy (${(p.nextOrderDays ?? 0) + (p.leadDays ?? 0)} d) — w Kreatorze zaznacz „Do kolejnej dostawy”.`
            : "Zapas z karty wystarcza do kolejnej dostawy — zamów dziś, nie czekaj na termin z planu."}
        </p>
      ) : null}
      {p.unpricedCount > 0 ? (
        <p className="mt-0.5 text-[11px] text-slate-500">
          {p.unpricedCount} {p.unpricedCount === 1 ? "pozycja" : "pozycji"} bez ceny z ZD — poza wartością
        </p>
      ) : null}

      {p.mostUrgent ? (
        <p className="mt-2 truncate text-xs text-slate-600" title={p.mostUrgent.twNazwa}>
          Najpilniej: <span className="font-mono font-semibold">{p.mostUrgent.twSymbol ?? p.mostUrgent.twNazwa}</span>
          {" — "}
          {p.mostUrgent.daysOfCover == null
            ? "poniżej minimum"
            : p.mostUrgent.daysOfCover <= 0
              ? "brak"
              : `starczy na ${formatCover(p.mostUrgent.daysOfCover, "warning")}`}
        </p>
      ) : null}

      {p.warnings.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-amber-800">
          {p.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto space-y-1.5 pt-4">
        {canMutate ? (
          <>
            <Link
              href={buildZdEstimateLaunchHref(p.supplierId)}
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Przygotuj ZD
            </Link>
            {hasDeliveryRisk && horizonExtends ? (
              <Link
                href={buildZdEstimateLaunchHref(p.supplierId, { leadTimeHorizon: true })}
                className="inline-flex h-9 w-full items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-[13px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
                title="Otwiera Kreator z zaznaczoną opcją „Do kolejnej dostawy” — możesz ją odznaczyć"
              >
                Przygotuj ZD do kolejnej dostawy
              </Link>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}

function RotationSection({ rows }: { rows: StockWatchRowView[] }) {
  return (
    <Card padding={false} className="overflow-hidden">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-900">Top 20 najszybciej rotujących</h2>
        <p className="text-xs text-slate-500">
          Pasek: stan dostępny względem celu zapasu z Kreatora (rotacja × dni zapasu dostawcy). Kreska = 100% celu,
          kreskowanie = towar w drodze.
        </p>
      </div>
      <TableScroll className="sm:px-0 sm:pb-0">
        <DataTable className="min-w-[760px]">
          <thead>
            <tr>
              <th scope="col" className="w-10 text-right">#</th>
              <th scope="col">Towar</th>
              <th scope="col" className="text-right" title="Średnia dzienna sprzedaż (szt/dzień) z okna Kreatora ZD">Rotacja</th>
              <th scope="col">Stan vs cel</th>
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
                  <p className="truncate text-[11px] text-slate-500">{row.supplierName}</p>
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
                  />
                  <p className="text-[11px] text-slate-500">cel na {row.salesPeriodDays} dni</p>
                </td>
                <td>
                  <CoverChip row={row} />
                </td>
                <td>
                  <span className={cn("text-xs", row.rule === "standard" ? "text-slate-500" : "font-medium text-indigo-800")}>
                    {STOCK_WATCH_RULE_META[row.rule].label}
                  </span>
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
              Te same flagi co w kreatorze ZD — zmiana działa w obu miejscach od razu.{" "}
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
              <td className="max-w-[10rem] truncate text-sm text-slate-700">{row.supplierName ?? "—"}</td>
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
