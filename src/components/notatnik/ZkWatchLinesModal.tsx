"use client";

import { useEffect, useMemo, useState } from "react";
import { actionUpdateZkWatchLineChecks } from "@/app/actions/sales-notepad";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import { cn } from "@/lib/cn";
import {
  buildZkWatchLineViews,
  checksFromLineViews,
  formatZkLinesProgress,
  summarizeZkWatchLines,
  type ZkWatchLineView,
} from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

type LineFilter = "all" | "pending" | "arrived";

function filterViews(views: ZkWatchLineView[], filter: LineFilter): ZkWatchLineView[] {
  if (filter === "pending") return views.filter((v) => !v.arrived);
  if (filter === "arrived") return views.filter((v) => v.arrived);
  return views;
}

export function ZkWatchLinesModal({
  watch,
  open,
  readOnly,
  tourPreview = false,
  matchedDeliveredLineKeys,
  onClose,
  onSaved,
}: {
  watch: SalesZkWatch;
  open: boolean;
  readOnly?: boolean;
  tourPreview?: boolean;
  /** Pozycje dopasowane do dostarczonych prośb (podświetlenie). */
  matchedDeliveredLineKeys?: string[];
  onClose: () => void;
  onSaved?: (watch: SalesZkWatch) => void;
}) {
  const [views, setViews] = useState<ZkWatchLineView[]>(() => buildZkWatchLineViews(watch));
  const [filter, setFilter] = useState<LineFilter>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setViews(buildZkWatchLineViews(watch));
    setFilter("all");
    setError(null);
  }, [open, watch]);

  const summary = useMemo(() => summarizeZkWatchLines(views), [views]);
  const filtered = useMemo(() => filterViews(views, filter), [views, filter]);
  const matchedFromProsba = useMemo(
    () => new Set(matchedDeliveredLineKeys ?? []),
    [matchedDeliveredLineKeys]
  );
  const prosbaMatchedCount = useMemo(
    () => views.filter((v) => v.key !== "summary" && matchedFromProsba.has(v.key)).length,
    [views, matchedFromProsba]
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
      setViews(buildZkWatchLineViews(updated));
      onSaved?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się zapisać.");
    } finally {
      setSaving(false);
    }
  }

  function toggleLine(key: string) {
    const next = views.map((v) =>
      v.key === key ? { ...v, arrived: !v.arrived } : v
    );
    void persist(next);
  }

  function setAllArrived(arrived: boolean) {
    const next = views.map((v) => ({ ...v, arrived }));
    void persist(next);
  }

  const filterChips: { id: LineFilter; label: string; count: number }[] = [
    { id: "all", label: "Wszystkie", count: summary.total },
    { id: "pending", label: "Brakuje", count: summary.pending },
    { id: "arrived", label: "Na miejscu", count: summary.arrived },
  ];

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      size="lg"
      title={`Towar — ${watch.zk_number}`}
      description={`${watch.client_label} · zaznacz, co już przyszło`}
      loadingMessage={saving ? "Zapisywanie…" : null}
      disableBackdropClose={saving}
      bodyClassName="px-4 py-3 sm:px-5 sm:py-4"
      footer={
        <>
          {canEdit ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving || summary.arrived === summary.total}
                onClick={() => setAllArrived(true)}
              >
                Wszystko na miejscu
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving || summary.arrived === 0}
                onClick={() => setAllArrived(false)}
              >
                Wyczyść zaznaczenia
              </Button>
            </>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Zamknij
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              {formatZkLinesProgress(views) ?? "Brak pozycji"}
            </span>
            <span className="tabular-nums font-medium text-slate-800">{progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {prosbaMatchedCount > 0 ? (
          <p className="rounded-md border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-2 text-xs leading-snug text-emerald-950">
            <span className="font-medium">
              {prosbaMatchedCount === 1
                ? "1 pozycja pasuje"
                : `${prosbaMatchedCount} pozycje pasują`}{" "}
              do dostarczonej prośby
            </span>
            {" — "}
            podświetlone wiersze możesz od razu oznaczyć jako na miejscu.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              disabled={chip.count === 0 && chip.id !== "all"}
              onClick={() => setFilter(chip.id)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[0.68rem] font-semibold transition",
                filter === chip.id
                  ? "bg-indigo-100 text-indigo-900"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200/80",
                chip.count === 0 && chip.id !== "all" && "opacity-40"
              )}
            >
              {chip.label}
              <span className="ml-1 tabular-nums opacity-80">{chip.count}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-xs text-slate-500">
            {filter === "pending"
              ? "Wszystkie pozycje są już oznaczone jako na miejscu."
              : filter === "arrived"
                ? "Nic jeszcze nie oznaczono jako dostarczone."
                : "Brak pozycji do wyświetlenia."}
          </p>
        ) : (
          <ul className="max-h-[min(52vh,28rem)] divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200/90">
            {filtered.map((line) => {
              const fromProsba = matchedFromProsba.has(line.key);
              return (
              <li key={line.key}>
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-3 py-2.5 transition hover:bg-slate-50/80",
                    line.arrived && "bg-emerald-50/40",
                    fromProsba &&
                      !line.arrived &&
                      "bg-indigo-50/50 ring-1 ring-inset ring-indigo-200/90",
                    fromProsba && line.arrived && "ring-1 ring-inset ring-emerald-200/80",
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
                        "block text-sm font-medium text-slate-900",
                        line.arrived && "text-slate-500 line-through decoration-slate-400"
                      )}
                    >
                      {line.product}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {[line.symbol, line.quantityLabel].filter(Boolean).join(" · ") ||
                        "—"}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    {fromProsba ? (
                      <span className="text-[0.65rem] font-semibold text-indigo-800">
                        Z prośby
                      </span>
                    ) : null}
                    {line.arrived ? (
                      <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-emerald-700">
                        OK
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            );
            })}
          </ul>
        )}

        {error ? <p className="text-xs text-red-600">{error}</p> : null}
        {!canEdit && !readOnly ? (
          <p className="text-xs text-slate-500">
            Podgląd tylko do odczytu — edycja dostępna na własnym koncie.
          </p>
        ) : null}
      </div>
    </ModalShell>
  );
}
