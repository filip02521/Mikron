"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { IconAlertCircle, IconChevronDown, IconSearch, IconTruck } from "@/components/icons/StrokeIcons";
import { daysFromToday, formatDaysAhead } from "@/components/summary/SupplierStockSignal";
import { StockRuleMenu } from "@/components/stock-watch/StockRuleControl";
import {
  CoverChip,
  formatShortDate,
  formatWhen,
  IncomingTag,
  OrderQty,
  ProductCell,
  VelocityCell,
} from "@/components/stock-watch/StockWatchCells";
import { formatPln, formatQtyPl } from "@/components/stock-watch/stock-watch-format";
import { polishPlural, polishPluralWord, polishPozycjeLabel } from "@/lib/email/polish-plural";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchSupplierBoardRow } from "@/lib/stock-watch/dashboard";
import { STOCK_WATCH_PRIORITY_ORDER, type StockWatchPriority } from "@/lib/stock-watch/priority";
import { stockWatchHorizonDays } from "@/lib/stock-watch/signal";
import { stockWatchProposalUsesHorizon, stockWatchSupplierRowHref } from "@/lib/stock-watch/status-line";

type TierFilter = "all" | StockWatchPriority;

/** Słownik priorytetów: etykieta, podpowiedź i kolor stanu (DESIGN.md: czerwony / bursztyn / neutralny / Petrol-informacja). */
const PRIORITY_META: Record<
  StockWatchPriority,
  { label: string; hint: string; dot: string; chip: string; group: string }
> = {
  now: {
    label: "Teraz",
    hint: "Pusta półka bez dostawy albo stan na ≤ 48 h",
    dot: "bg-red-600",
    chip: "bg-red-50 text-red-800",
    group: "text-red-800",
  },
  today: {
    label: "Dziś",
    hint: "Skończy się przed dostawą zamówienia złożonego dziś",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900",
    group: "text-amber-900",
  },
  soon: {
    label: "Wkrótce",
    hint: "Skończy się przed dostawą z kolejnego planowego zamówienia",
    dot: "bg-amber-300",
    chip: "bg-amber-50/60 text-amber-900",
    group: "text-amber-900",
  },
  restock: {
    label: "Uzupełnienie",
    hint: "Poniżej celu zapasu — przy najbliższym ZD",
    dot: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700",
    group: "text-slate-700",
  },
  attention: {
    label: "Do sprawdzenia",
    hint: "Nic do zamówienia, ale Kreator zgłasza problem z danymi — lista może być pusta albo niepełna",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-900",
    group: "text-amber-900",
  },
  waiting: {
    label: "Czeka na dostawę",
    hint: "Braki, ale wszystko już jedzie na otwartych ZD — nie zamawiaj drugi raz",
    dot: "bg-indigo-600",
    chip: "bg-indigo-50 text-indigo-800",
    group: "text-indigo-800",
  },
};

const COLS = 9;
const thClass = "whitespace-nowrap px-3 py-2.5";

function nextOrderText(row: StockWatchSupplierBoardRow): string | null {
  const p = row.proposal;
  // Bez czasu dostawy nie wiemy też, czy brak daty to „na żądanie”, czy brak danych — jak stara karta.
  if (!p || p.leadDays == null) return null;
  const lead = `dostawa ~${p.leadDays} d${p.leadSource === "default" ? " (założenie)" : ""}`;
  const next = p.nextOrderDate
    ? `kolejne zam. ${formatShortDate(p.nextOrderDate)} (${formatDaysAhead(daysFromToday(p.nextOrderDate) ?? p.nextOrderDays ?? 0)})`
    : "zamówienie na żądanie";
  return `${lead} · ${next}`;
}

function PriorityChip({ priority }: { priority: StockWatchPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-semibold", meta.chip)}
      title={meta.hint}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

/** Liczba w kolumnie: zero jest blade, żeby oko łapało tylko to, co niezerowe. */
function Count({ value, alarm, sub }: { value: number; alarm?: boolean; sub?: string | null }) {
  if (value <= 0) {
    return (
      <span className="text-slate-300">
        <span aria-hidden>–</span>
        <span className="sr-only">0</span>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={cn("font-semibold tabular-nums", alarm ? "text-red-700" : "text-slate-900")}>{value}</span>
      {sub ? <span className="whitespace-nowrap text-xs font-normal text-slate-500">{sub}</span> : null}
    </span>
  );
}

/** Ostrzeżenie Kreatora w wierszu dostawcy — widoczne bez rozwijania. */
function DataWarning({ row }: { row: StockWatchSupplierBoardRow }) {
  const first = row.proposal?.warnings[0];
  if (!first) return null;
  return (
    <span className="mt-0.5 flex items-start gap-1 text-xs text-amber-900">
      <IconAlertCircle size={12} strokeWidth={2} className="mt-0.5 shrink-0" aria-hidden />
      <span className="min-w-0">
        {first}
        {row.dataWarnings > 1 ? ` (+${row.dataWarnings - 1})` : ""}
      </span>
    </span>
  );
}

const secondaryLinkClass =
  "inline-flex h-8 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-[0_1px_2px_rgba(21,25,32,.06)] transition-[background-color,transform] duration-150 ease-out hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1";

/** Rozwinięty dostawca: dlaczego ten priorytet, co zrobić w Kreatorze, jego pilne towary. */
function SupplierDetail({
  row,
  canMutate,
  onError,
  onOpenList,
}: {
  row: StockWatchSupplierBoardRow;
  canMutate: boolean;
  onError: (message: string) => void;
  onOpenList: (supplierId: string) => void;
}) {
  const p = row.proposal;
  const horizonDays = p ? stockWatchHorizonDays(p) : null;
  // Jak stara karta dostawcy: ryzyko liczone ze wszystkich towarów Standard (także brak / ≤ 48 h).
  const deliveryRisk = p != null && (p.beforeDeliveryCount > 0 || p.beforeNextDeliveryCount > 0);
  const notes: { tone: "danger" | "warning" | "muted"; text: string }[] = [];
  if (row.emptyNoIncoming > 0) {
    notes.push({
      tone: "danger",
      text: `${polishPlural(row.emptyNoIncoming, "towar", "towary", "towarów")} bez stanu i bez otwartego ZD.`,
    });
  }
  if (row.outOfStock > row.emptyNoIncoming) {
    notes.push({
      tone: "muted",
      text: `${polishPlural(row.outOfStock - row.emptyNoIncoming, "brak już jedzie", "braki już jadą", "braków już jedzie")} na otwartych ZD — Kreator je odlicza.`,
    });
  }
  if (row.criticalInTransit > 0) {
    notes.push({
      tone: "muted",
      text: `${polishPlural(row.criticalInTransit, "towar", "towary", "towarów")} na ≤ 48 h, ale dostawa z otwartych ZD zdąży.`,
    });
  }
  if (p && deliveryRisk) {
    notes.push({
      tone: p.beforeDeliveryCount > 0 ? "danger" : "warning",
      text: p.horizonExtends
        ? `Zapas ${p.dniZapasu} d nie wystarczy do kolejnej dostawy (${horizonDays ?? 0} d) — w Kreatorze zaznacz „Do kolejnej dostawy”.`
        : "Zapas z karty wystarcza do kolejnej dostawy — zamów dziś, nie czekaj na termin z planu.",
    });
  }
  if (p && p.unpricedCount > 0) {
    notes.push({ tone: "muted", text: `${polishPozycjeLabel(p.unpricedCount)} bez ceny z ZD — poza wartością.` });
  }
  for (const w of p?.warnings ?? []) notes.push({ tone: "warning", text: w });

  return (
    <div className="space-y-3 bg-slate-50/70 px-4 py-4 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {notes.length > 0 ? (
            <ul className="space-y-0.5 text-sm leading-snug">
              {notes.map((n) => (
                <li
                  key={n.text}
                  className={cn(
                    n.tone === "danger" ? "text-red-800" : n.tone === "warning" ? "text-amber-900" : "text-slate-600"
                  )}
                >
                  {n.text}
                </li>
              ))}
            </ul>
          ) : null}
          {p ? (
            <p className="text-xs text-slate-500 tabular-nums">
              Zapas {p.dniZapasu} dni · sprzedaż {p.dataOd} – {p.dataDo} · policzono {formatWhen(p.computedAt)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canMutate && p && p.horizonExtends && deliveryRisk && !stockWatchProposalUsesHorizon(p) ? (
            <Link
              href={buildZdEstimateLaunchHref(row.supplierId, { leadTimeHorizon: true })}
              className={secondaryLinkClass}
              title="Otwiera Kreator z zaznaczoną opcją „Do kolejnej dostawy” — możesz ją odznaczyć"
            >
              ZD do kolejnej dostawy
            </Link>
          ) : null}
          <button type="button" onClick={() => onOpenList(row.supplierId)} className={secondaryLinkClass}>
            Lista braków dostawcy
          </button>
        </div>
      </div>

      {row.urgentRows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-500">
                  <th scope="col" className="px-3 py-2">Towar</th>
                  <th scope="col" className="px-3 py-2">Starczy na</th>
                  <th scope="col" className="px-3 py-2">Stan · w drodze</th>
                  <th scope="col" className="px-3 py-2 text-right">Rotacja</th>
                  <th scope="col" className="px-3 py-2 text-right">Do ZD</th>
                  {canMutate ? (
                    <th scope="col" className="px-3 py-2">
                      <span className="sr-only">Reguła</span>
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.urgentRows.map((r) => (
                  <tr key={r.subiektTwId} className="align-top">
                    <td className="px-3 py-2">
                      <ProductCell row={r} />
                    </td>
                    <td className="px-3 py-2">
                      <CoverChip row={r} />
                    </td>
                    <td className="px-3 py-2">
                      <span className="block text-xs tabular-nums text-slate-600">
                        {formatQtyPl(r.availableQty)} / cel {formatQtyPl(r.targetQty)} szt
                      </span>
                      <span className="mt-1 block">
                        <IncomingTag row={r} />
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <VelocityCell row={r} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <OrderQty row={r} />
                    </td>
                    {canMutate ? (
                      <td className="px-3 py-2 text-right">
                        <StockRuleMenu
                          subiektTwId={r.subiektTwId}
                          twSymbol={r.twSymbol}
                          twNazwa={r.twNazwa}
                          rule={r.rule}
                          onError={onError}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {row.urgentTotal > row.urgentRows.length ? (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Pokazano {row.urgentRows.length} najpilniejszych z {row.urgentTotal} — pełna lista w „Lista braków dostawcy”.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          {row.lineCount > 0
            ? `Nic pilnego — ${polishPozycjeLabel(row.lineCount)} do uzupełnienia zapasu w Kreatorze.`
            : row.outOfStock > 0 || row.criticalInTransit > 0
              ? "Nic do zamówienia — towar już jedzie na otwartych ZD."
              : "Nic pilnego na liście towarów."}
        </p>
      )}
    </div>
  );
}

/**
 * Tablica dostawców: jeden wiersz na dostawcę, posortowana od tego, co trzeba zamówić najpierw.
 * Duży dostawca z setką braków zajmuje jeden wiersz — towary dopiero po rozwinięciu.
 */
export function StockSupplierBoard({
  rows,
  quietSupplierCount,
  canMutate,
  onError,
  initialExpandedId = null,
  filtered = false,
  onOpenList,
}: {
  rows: StockWatchSupplierBoardRow[];
  quietSupplierCount: number;
  canMutate: boolean;
  onError: (message: string) => void;
  initialExpandedId?: string | null;
  /** Widok jednego dostawcy (`?dostawca=`). */
  filtered?: boolean;
  /** „Lista braków dostawcy” — przełącza panel na zakładkę braków z filtrem dostawcy. */
  onOpenList: (supplierId: string) => void;
}) {
  const [tier, setTier] = useState<TierFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(initialExpandedId ? [initialExpandedId] : [])
  );

  const tierCounts = useMemo(() => {
    const out = Object.fromEntries(STOCK_WATCH_PRIORITY_ORDER.map((p) => [p, 0])) as Record<StockWatchPriority, number>;
    for (const r of rows) out[r.priority] += 1;
    return out;
  }, [rows]);

  const q = query.trim().toLocaleLowerCase("pl");
  const visible = rows.filter(
    (r) => (tier === "all" || r.priority === tier) && (!q || r.supplierName.toLocaleLowerCase("pl").includes(q))
  );

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconTruck size={26} strokeWidth={1.75} />}
          title="Nic do zamówienia"
          description={
            filtered
              ? "Ten dostawca nie ma braków ani pozycji na liście „Do ZD”. Usuń filtr, żeby zobaczyć pozostałych."
              : "Żaden analizowany dostawca nie ma braków ani pozycji na liście „Do ZD”."
          }
        />
      </Card>
    );
  }

  const tierOptions: { value: TierFilter; label: string; title?: string }[] = [
    { value: "all", label: `Wszyscy ${rows.length}` },
    ...STOCK_WATCH_PRIORITY_ORDER.filter((p) => tierCounts[p] > 0).map((p) => ({
      value: p,
      label: `${PRIORITY_META[p].label} ${tierCounts[p]}`,
      title: PRIORITY_META[p].hint,
    })),
  ];

  return (
    <Card padding={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <SegmentedControl
            value={tier}
            onChange={setTier}
            ariaLabel="Priorytet dostawców"
            density="compact"
            options={tierOptions}
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="relative block w-full lg:w-60">
            <span className="sr-only">Szukaj dostawcy</span>
            <IconSearch
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Szukaj dostawcy"
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 sm:h-9 sm:text-sm"
            />
          </label>
          {quietSupplierCount > 0 ? (
            <span className="hidden shrink-0 text-xs text-slate-500 lg:inline" title="Analizowani dostawcy bez braków i bez listy „Do ZD”">
              + {quietSupplierCount} bez braków
            </span>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Brak dostawców w tym filtrze.</p>
      ) : (
        <>
          {/* Telefon: karty dostawców */}
          <ul className="divide-y divide-slate-100 md:hidden">
            {visible.map((r) => {
              const open = expanded.has(r.supplierId);
              const detailId = `dostawca-m-${r.supplierId}`;
              const facts = [
                r.emptyNoIncoming > 0 ? `${polishPlural(r.emptyNoIncoming, "pusty", "puste", "pustych")} bez dostawy` : null,
                r.outOfStock > r.emptyNoIncoming ? `${polishPlural(r.outOfStock - r.emptyNoIncoming, "brak", "braki", "braków")} w drodze` : null,
                r.critical > 0 ? `${r.critical} ≤ 48 h` : null,
                r.criticalInTransit > 0 ? `${r.criticalInTransit} ≤ 48 h w drodze` : null,
                r.beforeDelivery > 0 ? `${r.beforeDelivery} przed dostawą` : null,
                r.beforeNextDelivery > 0 ? `${r.beforeNextDelivery} przed kolejną` : null,
              ].filter(Boolean);
              return (
                <li key={r.supplierId}>
                  <button
                    type="button"
                    onClick={() => toggle(r.supplierId)}
                    aria-expanded={open}
                    aria-controls={detailId}
                    className="flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-600"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <PriorityChip priority={r.priority} />
                        <span className="truncate text-sm font-semibold text-slate-900">{r.supplierName}</span>
                      </span>
                      {facts.length > 0 ? (
                        <span className="mt-1 block text-xs tabular-nums text-slate-700">{facts.join(" · ")}</span>
                      ) : null}
                      <DataWarning row={r} />
                      <span className="mt-0.5 block text-xs tabular-nums text-slate-500">
                        {r.lineCount > 0
                          ? `Do ZD ${polishPozycjeLabel(r.lineCount)}${r.orderValue > 0 ? `, ok. ${formatPln(r.orderValue)}` : ""}`
                          : "Lista „Do ZD” pusta"}
                        {nextOrderText(r) ? ` · ${nextOrderText(r)}` : ""}
                      </span>
                    </span>
                    <IconChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      className={cn("mt-1 shrink-0 text-slate-400 transition-transform duration-150", open && "rotate-180")}
                    />
                  </button>
                  {canMutate && r.priority !== "waiting" ? (
                    <div className="px-4 pb-3">
                      <Link href={stockWatchSupplierRowHref(r)} className={cn(secondaryLinkClass, "h-10 w-full")}>
                        Przygotuj ZD
                      </Link>
                    </div>
                  ) : null}
                  {open ? (
                    <div id={detailId}>
                      <SupplierDetail row={r} canMutate={canMutate} onError={onError} onOpenList={onOpenList} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {/* Desktop: jedna zwarta tabela */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-semibold text-slate-500">
                  <th scope="col" className="w-10 py-2.5 pl-4">
                    <span className="sr-only">Rozwiń</span>
                  </th>
                  <th scope="col" className={cn(thClass, "text-left")}>Priorytet</th>
                  <th scope="col" className={cn(thClass, "text-left")}>Dostawca</th>
                  <th scope="col" className={cn(thClass, "text-right")} title="Zero na stanie i nic na otwartych ZD">
                    Puste
                  </th>
                  <th scope="col" className={cn(thClass, "text-right")} title="Stan dostępny ≤ 0 (pod spodem: ile z nich już jedzie)">
                    Brak
                  </th>
                  <th scope="col" className={cn(thClass, "text-right")} title="Starczy na ≤ 48 h">
                    48 h
                  </th>
                  <th
                    scope="col"
                    className={cn(thClass, "text-right")}
                    title="Skończy się przed dostawą dzisiejszego ZD (pod spodem: przed kolejną dostawą)"
                  >
                    Przed dost.
                  </th>
                  <th scope="col" className={cn(thClass, "text-right")}>Do ZD</th>
                  <th scope="col" className={cn(thClass, "pr-4 text-right")}>
                    <span className="sr-only">Akcja</span>
                  </th>
                </tr>
              </thead>
              {visible.map((r, i) => {
                const open = expanded.has(r.supplierId);
                const detailId = `dostawca-d-${r.supplierId}`;
                const newTier = tier === "all" && (i === 0 || visible[i - 1]!.priority !== r.priority);
                return (
                  <tbody key={r.supplierId} id={`dostawca-${r.supplierId}`} className="scroll-mt-16">
                    {newTier ? (
                      <tr>
                        <th
                          scope="rowgroup"
                          colSpan={COLS}
                          className={cn(
                            "border-t border-slate-200 bg-white px-4 pb-1.5 pt-4 text-left text-xs font-semibold",
                            PRIORITY_META[r.priority].group
                          )}
                        >
                          {PRIORITY_META[r.priority].label}
                          <span className="ml-2 font-medium normal-case tracking-normal text-slate-500">
                            {tierCounts[r.priority]}{" "}
                            {polishPluralWord(tierCounts[r.priority], "dostawca", "dostawcy", "dostawców")} ·{" "}
                            {PRIORITY_META[r.priority].hint}
                          </span>
                        </th>
                      </tr>
                    ) : null}
                    <tr
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a,button")) return;
                        toggle(r.supplierId);
                      }}
                      className={cn(
                        "cursor-pointer border-t border-slate-100 transition-colors hover:bg-slate-50",
                        open && "bg-slate-50"
                      )}
                    >
                      <td className="py-2.5 pl-4 align-middle">
                        <button
                          type="button"
                          onClick={() => toggle(r.supplierId)}
                          aria-expanded={open}
                          aria-controls={detailId}
                          aria-label={`${open ? "Zwiń" : "Rozwiń"} ${r.supplierName}`}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                        >
                          <IconChevronDown
                            size={16}
                            strokeWidth={2}
                            className={cn("transition-transform duration-150", open && "rotate-180")}
                          />
                        </button>
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <PriorityChip priority={r.priority} />
                      </td>
                      <td className="max-w-[15rem] px-3 py-2.5 align-middle">
                        <span className="block truncate font-semibold text-slate-900" title={r.supplierName}>
                          {r.supplierName}
                        </span>
                        {nextOrderText(r) ? (
                          <span className="block truncate text-xs text-slate-500">{nextOrderText(r)}</span>
                        ) : null}
                        <DataWarning row={r} />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <Count value={r.emptyNoIncoming} alarm />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <Count
                          value={r.outOfStock}
                          sub={r.outOfStock > r.emptyNoIncoming ? `${r.outOfStock - r.emptyNoIncoming} jedzie` : null}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <Count
                          value={r.critical}
                          alarm
                          sub={r.criticalInTransit > 0 ? `${r.criticalInTransit} jedzie` : null}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle">
                        <Count
                          value={r.beforeDelivery}
                          sub={r.beforeNextDelivery > 0 ? `+${r.beforeNextDelivery} kolejna` : null}
                        />
                        {r.beforeDelivery <= 0 && r.beforeNextDelivery > 0 ? (
                          <span className="block text-xs text-slate-500">+{r.beforeNextDelivery} kolejna</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle tabular-nums">
                        {r.lineCount > 0 ? (
                          <span className="inline-flex flex-col items-end leading-tight">
                            <span className="whitespace-nowrap font-semibold text-slate-900">{r.lineCount} poz.</span>
                            {r.orderValue > 0 ? (
                              <span className="whitespace-nowrap text-xs text-slate-500">{formatPln(r.orderValue)}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 pr-4 text-right align-middle">
                        {canMutate && r.priority !== "waiting" ? (
                          <Link href={stockWatchSupplierRowHref(r)} className={secondaryLinkClass}>
                            Przygotuj ZD
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                    {open ? (
                      <tr id={detailId}>
                        <td colSpan={COLS} className="p-0">
                          <SupplierDetail row={r} canMutate={canMutate} onError={onError} onOpenList={onOpenList} />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        </>
      )}
    </Card>
  );
}

