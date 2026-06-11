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
import type { SalesZkWatch } from "@/types/database";
import { ZkWatchModalSection } from "./ZkWatchModalSection";

type LineFilter = "all" | "pending" | "arrived";

function filterViews(views: ZkWatchLineView[], filter: LineFilter): ZkWatchLineView[] {
  if (filter === "pending") return views.filter((v) => !v.arrived);
  if (filter === "arrived") return views.filter((v) => v.arrived);
  return views;
}

export function ZkWatchLinesPanel({
  watch,
  readOnly,
  tourPreview = false,
  matchedDeliveredLineKeys,
  compact = false,
  showSummary = true,
  onSaved,
}: {
  watch: SalesZkWatch;
  readOnly?: boolean;
  tourPreview?: boolean;
  matchedDeliveredLineKeys?: string[];
  compact?: boolean;
  showSummary?: boolean;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const watchSyncKey = `${watch.id}\0${JSON.stringify(watch.line_checks ?? null)}`;
  const [appliedWatchSyncKey, setAppliedWatchSyncKey] = useState(watchSyncKey);
  const [views, setViews] = useState<ZkWatchLineView[]>(() => buildZkWatchLineViews(watch));
  const [filter, setFilter] = useState<LineFilter>("all");
  const [filterWatchId, setFilterWatchId] = useState(watch.id);
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
  }

  const summary = useMemo(() => summarizeZkWatchLines(views), [views]);
  const filtered = useMemo(() => filterViews(views, filter), [views, filter]);
  const matchedFromProsba = useMemo(
    () => new Set(matchedDeliveredLineKeys ?? []),
    [matchedDeliveredLineKeys]
  );
  const canEdit = !readOnly && !tourPreview && !watch.closed_at && !watch.archived_at;
  const progressPct =
    summary.total > 0 ? Math.round((summary.arrived / summary.total) * 100) : 0;

  async function persist(nextViews: ZkWatchLineView[]) {
    if (!canEdit) {
      setViews(nextViews);
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
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setSaving(false);
    }
  }

  function toggleLine(key: string) {
    const next = views.map((v) => (v.key === key ? { ...v, arrived: !v.arrived } : v));
    void persist(next);
  }

  const filterChips: { id: LineFilter; label: string; count: number }[] = [
    { id: "all", label: "Wszystkie", count: summary.total },
    { id: "pending", label: "Brakuje", count: summary.pending },
    { id: "arrived", label: "Na miejscu", count: summary.arrived },
  ];

  const emptyMessage =
    watch.line_summary?.trim() ||
    "Brak pozycji towarowych. Odśwież dane z Subiekta w menu ⋮ przy tym ZK.";

  const listBody = !views.length ? (
    <p className={cn("px-3 py-4 text-center", salesTypography.sectionHint)}>{emptyMessage}</p>
  ) : (
    <ul className="divide-y divide-slate-100">
      {filtered.map((line) => {
        const fromProsba = matchedFromProsba.has(line.key);
        return (
          <li key={line.key} className={mojeShipmentLineRowClass}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3",
                line.arrived && "opacity-90",
                fromProsba && !line.arrived && "rounded-sm bg-indigo-50/40 -mx-1 px-1",
                !canEdit && "cursor-default"
              )}
            >
              <input
                type="checkbox"
                checked={line.arrived}
                disabled={!canEdit || saving}
                onChange={() => toggleLine(line.key)}
                className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-indigo-500"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    salesTypography.rowTitle,
                    "block",
                    line.arrived && "text-slate-500 line-through decoration-slate-400"
                  )}
                >
                  {line.product}
                </span>
                {(line.symbol || line.quantityLabel) && !compact ? (
                  <span className={cn("mt-0.5 block", salesTypography.rowMeta)}>
                    {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </span>
              {fromProsba ? (
                <span
                  className={cn(
                    salesTypography.kindTag,
                    "shrink-0 rounded-full bg-indigo-100 px-1.5 py-0.5 text-indigo-800"
                  )}
                >
                  Prośba
                </span>
              ) : null}
            </label>
          </li>
        );
      })}
    </ul>
  );

  const panel = (
    <div className={cn(mojeShipmentLinesShellClass, saving && "pointer-events-none opacity-70")}>
      {showSummary && views.length > 0 ? (
        <div className={mojeShipmentLinesHeaderClass}>
          <p className={mojeShipmentLinesHeaderTitleClass}>
            {formatZkLinesProgress(views) ?? "Lista towaru"}
          </p>
          <div className="flex items-center gap-2">
            <span className={cn(salesTypography.statValue, "text-sm")}>{progressPct}%</span>
            {canEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[0.68rem]"
                disabled={saving || summary.arrived === summary.total}
                onClick={() => void persist(views.map((v) => ({ ...v, arrived: true })))}
              >
                Wszystko OK
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {views.length > 3 ? (
        <div className="flex flex-wrap gap-1 border-b border-slate-100 bg-slate-50/50 px-3 py-2">
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
      ) : null}

      <div className={cn(!compact && views.length > 0 && "max-h-[min(40vh,22rem)] overflow-y-auto")}>
        {listBody}
      </div>
    </div>
  );

  if (!showSummary) {
    return (
      <ZkWatchModalSection
        title="Lista towaru"
        hint="Zaznacz pozycje, które już dotarły do klienta."
      >
        {canEdit && views.length > 0 ? (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 px-2.5 text-[0.68rem]"
              disabled={saving || summary.arrived === summary.total}
              onClick={() => void persist(views.map((v) => ({ ...v, arrived: true })))}
            >
              Oznacz wszystko jako dotarło
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
