"use client";

import { useMemo, useState } from "react";
import { actionUpdateZkWatchLineChecks } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import {
  mojeShipmentLineRowClass,
  mojeShipmentLinesHeaderClass,
  mojeShipmentLinesHeaderTitleClass,
  mojeShipmentLinesShellClass,
} from "@/lib/ui/moje-shipment-row-styles";
import {
  buildZkWatchLineViews,
  checksFromLineViews,
  formatZkLinesProgress,
  summarizeZkWatchLines,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import {
  canToggleZkWatchLineCheckbox,
  isZkWatchLineCheckboxChecked,
  togglesZkWatchShelfMarked,
  togglesZkWatchCompletion,
  resolveZkWatchLineUiState,
  summarizeZkWatchLineCheckboxes,
  countZkWatchLineUiStates,
  zkWatchLineCheckboxAriaLabel,
  zkWatchLineUiStateMeta,
  type ZkWatchLineUiState,
} from "@/lib/sales/zk-watch-line-ui-state";
import {
  countZkWatchLinesOutsideTrackedScope,
  filterZkWatchProductLineViewsForScope,
  hasZkWatchTrackedProsbaScope,
} from "@/lib/sales/zk-watch-prosba-scope";
import type { ZkLinkableOrder, ZkWatchLineCoverage } from "@/lib/sales/zk-watch-order-link";
import { buildZkLineProsbaQuantityMeta } from "@/lib/sales/zk-watch-order-link";
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchLineStatusChip } from "./ZkWatchLineStatusChip";
import { ZkWatchLineStatusLegendToggle } from "./ZkWatchLineStatusLegendToggle";
import { ZkWatchLineCheckboxControl } from "./ZkWatchLineCheckboxControl";
import { ZK_MODAL_SECTION_HINTS, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

type LineFilter =
  | "all"
  | "pending"
  | "in_stock"
  | "at_client"
  | "delivered"
  | "informacja_ready"
  | "partial"
  | "new"
  | "in_request"
  | "scope_excluded";

function resolveLineUiState(
  line: ZkWatchLineView,
  newLineKeys: Set<string>,
  inStockKeySet: Set<string>,
  scopeExcludedKeySet: Set<string>,
  informacjaReadyKeySet: Set<string>,
  informacjaAcknowledgedKeySet: Set<string>,
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>
): ZkWatchLineUiState {
  return resolveZkWatchLineUiState({
    coverage: lineCoverageByKey?.[line.key],
    isNewLine: newLineKeys.has(line.key),
    arrived: line.arrived,
    completedManually: line.completed_manually,
    shelfMarked: line.shelf_marked,
    inStock: inStockKeySet.has(line.key),
    scopeExcluded: scopeExcludedKeySet.has(line.key),
    informacjaReady: informacjaReadyKeySet.has(line.key),
    informacjaAcknowledged: informacjaAcknowledgedKeySet.has(line.key),
  });
}

function filterViews(
  views: ZkWatchLineView[],
  filter: LineFilter,
  newLineKeys: Set<string>,
  inStockKeySet: Set<string>,
  scopeExcludedKeySet: Set<string>,
  informacjaReadyKeySet: Set<string>,
  informacjaAcknowledgedKeySet: Set<string>,
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>
): ZkWatchLineView[] {
  if (filter === "all") return views;
  return views.filter((line) => {
    const uiState = resolveLineUiState(
      line,
      newLineKeys,
      inStockKeySet,
      scopeExcludedKeySet,
      informacjaReadyKeySet,
      informacjaAcknowledgedKeySet,
      lineCoverageByKey
    );
    switch (filter) {
      case "new":
        return uiState === "new";
      case "in_request":
        return uiState === "in_request";
      case "pending":
        return uiState === "uncovered" || uiState === "new";
      case "in_stock":
        return uiState === "in_stock";
      case "at_client":
        return uiState === "arrived";
      case "delivered":
        return uiState === "delivered";
      case "informacja_ready":
        return uiState === "informacja_ready";
      case "partial":
        return uiState === "partial";
      case "scope_excluded":
        return uiState === "scope_excluded";
      default:
        return true;
    }
  });
}

export function ZkWatchLinesPanel({
  watch,
  readOnly,
  tourPreview = false,
  matchedDeliveredLineKeys,
  newLineKeys,
  lineCoverageByKey,
  inStockLineKeys,
  informacjaReadyLineKeys,
  informacjaAcknowledgedLineKeys,
  scopeExcludedLineKeys,
  linkableOrders = [],
  compact = false,
  showSummary = true,
  onSaved,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  matchedDeliveredLineKeys?: string[];
  newLineKeys?: string[];
  lineCoverageByKey?: Record<string, ZkWatchLineCoverage>;
  inStockLineKeys?: string[];
  informacjaReadyLineKeys?: string[];
  informacjaAcknowledgedLineKeys?: string[];
  scopeExcludedLineKeys?: string[];
  linkableOrders?: ZkLinkableOrder[];
  compact?: boolean;
  showSummary?: boolean;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const watchSyncKey = `${watch.id}\0${JSON.stringify(watch.line_checks ?? null)}`;
  const [appliedWatchSyncKey, setAppliedWatchSyncKey] = useState(watchSyncKey);
  const [views, setViews] = useState<ZkWatchLineView[]>(() => buildZkWatchLineViews(watch));
  const [filter, setFilter] = useState<LineFilter>("all");
  const [filterWatchId, setFilterWatchId] = useState(watch.id);
  const [showAllZkLines, setShowAllZkLines] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (watchSyncKey !== appliedWatchSyncKey) {
    setAppliedWatchSyncKey(watchSyncKey);
    setViews(buildZkWatchLineViews(watch));
    setError(null);
  }
  if (watch.id !== filterWatchId) {
    setFilterWatchId(watch.id);
    setFilter("all");
    setShowAllZkLines(false);
  }

  const hasTrackedScope = useMemo(
    () => hasZkWatchTrackedProsbaScope(watch),
    [watch.line_checks]
  );
  const hiddenOutsideScope = useMemo(
    () => countZkWatchLinesOutsideTrackedScope(watch, views),
    [watch, views]
  );
  const displayViews = useMemo(
    () => filterZkWatchProductLineViewsForScope(views, watch, { showAllLines: showAllZkLines }),
    [views, watch, showAllZkLines]
  );
  const scopeToggleVisible = hasTrackedScope && hiddenOutsideScope > 0;

  const summary = useMemo(() => summarizeZkWatchLines(displayViews), [displayViews]);
  const checkboxSummary = useMemo(
    () =>
      summarizeZkWatchLineCheckboxes({
        lineViews: displayViews,
        newLineKeys: newLineKeys ?? [],
        inStockLineKeys: inStockLineKeys ?? [],
        scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
        informacjaReadyLineKeys: informacjaReadyLineKeys ?? [],
        informacjaAcknowledgedLineKeys: informacjaAcknowledgedLineKeys ?? [],
        lineCoverageByKey,
      }),
    [displayViews, newLineKeys, inStockLineKeys, scopeExcludedLineKeys, informacjaReadyLineKeys, informacjaAcknowledgedLineKeys, lineCoverageByKey]
  );
  const uiStateCounts = useMemo(
    () =>
      countZkWatchLineUiStates({
        lineViews: displayViews,
        newLineKeys: newLineKeys ?? [],
        inStockLineKeys: inStockLineKeys ?? [],
        scopeExcludedLineKeys: scopeExcludedLineKeys ?? [],
        informacjaReadyLineKeys: informacjaReadyLineKeys ?? [],
        informacjaAcknowledgedLineKeys: informacjaAcknowledgedLineKeys ?? [],
        lineCoverageByKey,
      }),
    [displayViews, newLineKeys, inStockLineKeys, scopeExcludedLineKeys, informacjaReadyLineKeys, informacjaAcknowledgedLineKeys, lineCoverageByKey]
  );
  const newLineKeySet = useMemo(() => new Set(newLineKeys ?? []), [newLineKeys]);
  const inStockKeySet = useMemo(() => new Set(inStockLineKeys ?? []), [inStockLineKeys]);
  const informacjaReadyKeySet = useMemo(
    () => new Set(informacjaReadyLineKeys ?? []),
    [informacjaReadyLineKeys]
  );
  const informacjaAcknowledgedKeySet = useMemo(
    () => new Set(informacjaAcknowledgedLineKeys ?? []),
    [informacjaAcknowledgedLineKeys]
  );
  const scopeExcludedKeySet = useMemo(
    () => new Set(scopeExcludedLineKeys ?? []),
    [scopeExcludedLineKeys]
  );
  const inRequestCount = useMemo(
    () =>
      displayViews.filter(
        (v) =>
          resolveLineUiState(v, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey) ===
          "in_request"
      ).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const inStockCount = useMemo(
    () =>
      displayViews.filter(
        (v) =>
          resolveLineUiState(v, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey) ===
          "in_stock"
      ).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const atClientCount = useMemo(
    () =>
      displayViews.filter(
        (v) =>
          resolveLineUiState(v, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey) ===
          "arrived"
      ).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const deliveredCount = useMemo(
    () =>
      displayViews.filter(
        (v) =>
          resolveLineUiState(v, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey) ===
          "delivered"
      ).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const partialCount = useMemo(
    () =>
      displayViews.filter(
        (v) =>
          resolveLineUiState(v, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey) ===
          "partial"
      ).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const informacjaReadyCount = uiStateCounts.informacja_ready;
  const scopeExcludedCount = useMemo(
    () => displayViews.filter((line) => scopeExcludedKeySet.has(line.key)).length,
    [displayViews, scopeExcludedKeySet]
  );
  const pendingCount = useMemo(
    () =>
      displayViews.filter((v) => {
        const state = resolveLineUiState(
          v,
          newLineKeySet,
          inStockKeySet,
          scopeExcludedKeySet,
          informacjaReadyKeySet,
          informacjaAcknowledgedKeySet,
          lineCoverageByKey
        );
        return state === "uncovered" || state === "new";
      }).length,
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const newLineVisibleCount = useMemo(
    () => displayViews.filter((line) => newLineKeySet.has(line.key)).length,
    [displayViews, newLineKeySet]
  );
  const filtered = useMemo(
    () =>
      filterViews(
        displayViews,
        filter,
        newLineKeySet,
        inStockKeySet,
        scopeExcludedKeySet,
        informacjaReadyKeySet,
        informacjaAcknowledgedKeySet,
        lineCoverageByKey
      ),
    [displayViews, filter, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const matchedFromProsba = useMemo(
    () => new Set(matchedDeliveredLineKeys ?? []),
    [matchedDeliveredLineKeys]
  );
  const canEdit = !readOnly && !tourPreview && !watch.closed_at && !watch.archived_at;
  const hasBulkMarkWork = useMemo(
    () =>
      displayViews.some((line) => {
        const uiState = resolveLineUiState(
          line,
          newLineKeySet,
          inStockKeySet,
          scopeExcludedKeySet,
          informacjaReadyKeySet,
          informacjaAcknowledgedKeySet,
          lineCoverageByKey
        );
        if (!canToggleZkWatchLineCheckbox(uiState)) return false;
        return !isZkWatchLineCheckboxChecked({
          uiState,
          shelfMarked: line.shelf_marked,
          completedManually: line.completed_manually,
        });
      }),
    [displayViews, newLineKeySet, inStockKeySet, scopeExcludedKeySet, informacjaReadyKeySet, informacjaAcknowledgedKeySet, lineCoverageByKey]
  );
  const progressPct =
    checkboxSummary.total > 0
      ? Math.round((checkboxSummary.checked / checkboxSummary.total) * 100)
      : 0;

  function markAllBulk(nextViews: ZkWatchLineView[]): ZkWatchLineView[] {
    return nextViews.map((line) => {
      const uiState = resolveLineUiState(
        line,
        newLineKeySet,
        inStockKeySet,
        scopeExcludedKeySet,
        informacjaReadyKeySet,
        informacjaAcknowledgedKeySet,
        lineCoverageByKey
      );
      if (!canToggleZkWatchLineCheckbox(uiState)) return line;
      if (
        isZkWatchLineCheckboxChecked({
          uiState,
          shelfMarked: line.shelf_marked,
          completedManually: line.completed_manually,
        })
      ) {
        return line;
      }
      if (togglesZkWatchCompletion(uiState)) {
        return { ...line, arrived: true, completed_manually: true };
      }
      return { ...line, shelf_marked: true };
    });
  }

  function applyBulkMarkToDisplayedLines(allViews: ZkWatchLineView[]): ZkWatchLineView[] {
    const displayKeys = new Set(displayViews.map((line) => line.key));
    const marked = markAllBulk(allViews.filter((line) => displayKeys.has(line.key)));
    const markedByKey = new Map(marked.map((line) => [line.key, line]));
    return allViews.map((line) => markedByKey.get(line.key) ?? line);
  }

  const scopeLinesToggle = scopeToggleVisible ? (
    <div className="flex justify-end">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[0.68rem] font-semibold text-indigo-800 hover:bg-indigo-50/80"
        onClick={() => setShowAllZkLines((value) => !value)}
      >
        {showAllZkLines
          ? "Pokaż wybrane pozycje"
          : `Pokaż wszystkie pozycje ZK (+${hiddenOutsideScope})`}
      </Button>
    </div>
  ) : null;

  async function persist(nextViews: ZkWatchLineView[]) {
    const previousViews = views;
    setViews(nextViews);
    if (!canEdit) {
      onSaved?.({ ...watch, line_checks: checksFromLineViews(nextViews) });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { watch: updated } = await actionUpdateZkWatchLineChecks(
        watch.id,
        checksFromLineViews(nextViews)
      );
      const rebuilt = buildZkWatchLineViews(updated);
      setViews(rebuilt);
      onSaved?.(updated);
    } catch (e) {
      setViews(previousViews);
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setSaving(false);
    }
  }

  function toggleLine(key: string) {
    const line = views.find((v) => v.key === key);
    if (!line) return;
    const uiState = resolveLineUiState(
      line,
      newLineKeySet,
      inStockKeySet,
      scopeExcludedKeySet,
      informacjaReadyKeySet,
      informacjaAcknowledgedKeySet,
      lineCoverageByKey
    );
    if (!canToggleZkWatchLineCheckbox(uiState)) return;
    const next = views.map((v) => {
      if (v.key !== key) return v;
      if (togglesZkWatchCompletion(uiState)) {
        const nextCompleted = !v.completed_manually;
        return {
          ...v,
          arrived: nextCompleted,
          completed_manually: nextCompleted,
        };
      }
      if (togglesZkWatchShelfMarked(uiState)) {
        return { ...v, shelf_marked: !v.shelf_marked };
      }
      return v;
    });
    void persist(next);
  }

  const filterChips: { id: LineFilter; label: string; count: number }[] = [
    { id: "all", label: "Wszystkie", count: checkboxSummary.total || summary.total },
    ...(newLineVisibleCount > 0
      ? [{ id: "new" as const, label: "Nowe", count: newLineVisibleCount }]
      : []),
    ...(pendingCount > 0
      ? [{ id: "pending" as const, label: "Do prośby", count: pendingCount }]
      : []),
    ...(scopeExcludedCount > 0
      ? [{ id: "scope_excluded" as const, label: "Pominięte", count: scopeExcludedCount }]
      : []),
    ...(inRequestCount > 0
      ? [{ id: "in_request" as const, label: "W prośbie", count: inRequestCount }]
      : []),
    ...(partialCount > 0
      ? [{ id: "partial" as const, label: "Częściowo", count: partialCount }]
      : []),
    ...(informacjaReadyCount > 0
      ? [{ id: "informacja_ready" as const, label: "Dostępne", count: informacjaReadyCount }]
      : []),
    ...(deliveredCount > 0
      ? [{ id: "delivered" as const, label: "Na regale", count: deliveredCount }]
      : []),
    ...(inStockCount > 0
      ? [{ id: "in_stock" as const, label: "Odebrane z regału", count: inStockCount }]
      : []),
    ...(atClientCount > 0
      ? [{ id: "at_client" as const, label: "Zakończone", count: atClientCount }]
      : []),
  ];

  const emptyMessage =
    watch.line_summary?.trim() ||
    "Brak pozycji towarowych. Odśwież dane z Subiekta w menu ⋮ przy tym ZK.";

  const listBody = !displayViews.length ? (
    <p className={cn("px-3 py-4 text-center", salesTypography.sectionHint)}>
      {views.length > 0 && hasTrackedScope && !showAllZkLines
        ? "Brak wybranych pozycji do wyświetlenia — rozwiń pełne ZK z Subiekta."
        : emptyMessage}
    </p>
  ) : (
    <ul className="divide-y divide-slate-100">
      {filtered.map((line) => {
        const uiState = resolveLineUiState(
          line,
          newLineKeySet,
          inStockKeySet,
          scopeExcludedKeySet,
          informacjaReadyKeySet,
          informacjaAcknowledgedKeySet,
          lineCoverageByKey
        );
        const meta = zkWatchLineUiStateMeta(uiState);
        const fromProsba = matchedFromProsba.has(line.key);
        const strikeThrough = uiState === "arrived";
        const lineChecked = isZkWatchLineCheckboxChecked({
          uiState,
          shelfMarked: line.shelf_marked,
          completedManually: line.completed_manually,
        });
        const prosbaQtyMeta = buildZkLineProsbaQuantityMeta(line, linkableOrders, watch);
        const metaLineParts = prosbaQtyMeta
          ? [line.symbol, prosbaQtyMeta.displayLabel].filter(Boolean)
          : [line.symbol, line.quantityLabel].filter(Boolean);
        const metaLineTitle = prosbaQtyMeta?.title;
        const lineToggleable =
          canEdit && !saving && canToggleZkWatchLineCheckbox(uiState);
        const checkboxToneClass =
          uiState === "in_stock" || uiState === "arrived"
            ? uiState === "arrived"
              ? "bg-emerald-600"
              : "bg-teal-600"
            : uiState === "delivered" || uiState === "partial"
              ? "bg-violet-600"
              : "bg-indigo-600";

        return (
          <li key={line.key} className={mojeShipmentLineRowClass}>
            <div
              className={cn(
                "flex items-center gap-3 py-0.5",
                meta.rowTintClass && `rounded-md ${meta.rowTintClass} -mx-1 px-1`,
                fromProsba && !meta.rowTintClass && "rounded-md bg-indigo-50/25 -mx-1 px-1",
                lineToggleable ? "cursor-pointer" : "cursor-default"
              )}
              onClick={() => {
                if (lineToggleable) toggleLine(line.key);
              }}
            >
              <ZkWatchLineCheckboxControl
                checked={lineChecked}
                toggleable={lineToggleable}
                toneClass={checkboxToneClass}
                ariaLabel={zkWatchLineCheckboxAriaLabel({
                  product: line.product,
                  checked: lineChecked,
                  uiState,
                  completedManually: line.completed_manually,
                })}
                onToggle={() => toggleLine(line.key)}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    salesTypography.rowTitle,
                    "block",
                    strikeThrough && "text-slate-500 line-through decoration-slate-400"
                  )}
                >
                  {line.product}
                </span>
                {(line.symbol || line.quantityLabel || prosbaQtyMeta) && !compact ? (
                  <span
                    className={cn("mt-0.5 block", salesTypography.rowMeta)}
                    title={metaLineTitle}
                  >
                    {metaLineParts.join(" · ")}
                  </span>
                ) : null}
              </span>
              <ZkWatchLineStatusChip state={uiState} />
            </div>
          </li>
        );
      })}
    </ul>
  );

  const panel = (
    <div className={cn(mojeShipmentLinesShellClass, saving && "pointer-events-none opacity-70")}>
      {showSummary && displayViews.length > 0 ? (
        <div className={mojeShipmentLinesHeaderClass}>
          <p className={mojeShipmentLinesHeaderTitleClass}>
            {checkboxSummary.total > 0
              ? `${checkboxSummary.checked}/${checkboxSummary.total} zaznaczone`
              : formatZkLinesProgress(displayViews, { inStockLineKeys }) ?? "Lista towaru"}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(salesTypography.statValue, "text-sm")}>{progressPct}%</span>
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[0.68rem]"
                disabled={saving || !hasBulkMarkWork}
                onClick={() => void persist(applyBulkMarkToDisplayedLines(views))}
              >
                Wszystko OK
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {showSummary ? scopeLinesToggle : null}

      {displayViews.length > 3 || filterChips.length > 2 ? (
        <div className="space-y-2 border-b border-slate-100 bg-slate-50/50 px-3 py-2">
          <div className="flex flex-wrap gap-1">
            {filterChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                disabled={chip.count === 0 && chip.id !== "all"}
                onClick={() => setFilter(chip.id)}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.68rem] font-semibold transition",
                  filter === chip.id
                    ? "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/80"
                    : "bg-white text-slate-600 ring-1 ring-slate-200/90 hover:bg-slate-50",
                  chip.count === 0 && chip.id !== "all" && "opacity-40"
                )}
              >
                {chip.label}
                <span className="ml-1 tabular-nums opacity-80">{chip.count}</span>
              </button>
            ))}
          </div>
          <ZkWatchLineStatusLegendToggle counts={uiStateCounts} />
        </div>
      ) : null}

      <div className={cn(!compact && displayViews.length > 0 && "max-h-[min(40vh,22rem)] overflow-y-auto")}>
        {listBody}
      </div>
    </div>
  );

  if (!showSummary) {
    return (
      <ZkWatchModalSection title={ZK_MODAL_SECTION_TITLES.lines} hint={ZK_MODAL_SECTION_HINTS.lines}>
        {scopeLinesToggle}
        {canEdit && displayViews.length > 0 ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-[0.68rem]"
              disabled={saving || !hasBulkMarkWork}
              onClick={() => void persist(applyBulkMarkToDisplayedLines(views))}
            >
              Oznacz wszystko jako zakończone
            </Button>
          </div>
        ) : null}
        {panel}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </ZkWatchModalSection>
    );
  }

  return (
    <div className={cn("space-y-2", saving && "pointer-events-none opacity-70")}>
      {panel}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
