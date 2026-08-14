"use client";

import { useEffect, useState, useTransition } from "react";
import {
  actionGetZdEstimateSnapshotLines,
  actionListZdEstimateSnapshots,
  actionSetZdEstimateSnapshotHistoryEligible,
} from "@/app/actions/zd-estimate";
import type {
  ZdEstimateOrderSnapshotLineRow,
  ZdEstimateOrderSnapshotRow,
} from "@/lib/data/zd-estimate-order-snapshots";
import { IconLink } from "@/components/icons/StrokeIcons";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ModalShell } from "@/components/ui/ModalShell";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatWarsawTime,
  isDateOnlyTimestamp,
} from "@/lib/orders/procurement-request-timing";
import {
  ZD_ESTIMATE_UI,
  zdEstimateSnapshotsFooterCount,
  zdEstimateSnapshotsLinesCount,
} from "@/lib/orders/zd-estimate-ui-copy";

function snapshotDokLabel(s: ZdEstimateOrderSnapshotRow): string {
  return s.dokNrPelny.trim() || `ZD ${s.dokId}`;
}

function snapshotLinkedLabel(iso: string): string {
  const date = formatPlDate(iso);
  if (isDateOnlyTimestamp(iso)) return date;
  return `${date} · ${formatWarsawTime(iso)}`;
}

function snapshotScopeLabel(s: ZdEstimateOrderSnapshotRow): string {
  if (s.scopeMode === "cecha") {
    return s.cechaId != null ? `Cecha ${s.cechaId}` : "Cecha";
  }
  if (s.scopeMode === "grupa") {
    return s.grtId != null ? `Grupa ${s.grtId}` : "Grupa";
  }
  return ZD_ESTIMATE_UI.snapshotsScopeLegacy;
}

function SnapshotMetaBadges({
  snapshot,
  dense = false,
}: {
  snapshot: ZdEstimateOrderSnapshotRow;
  dense?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        variant={snapshot.hostKind === "live" ? "warning" : "success"}
        className={cn(dense && "px-1.5 py-0 text-[10px]")}
      >
        {snapshot.hostKind === "live"
          ? ZD_ESTIMATE_UI.snapshotsHostLive
          : ZD_ESTIMATE_UI.snapshotsHostTest}
      </Badge>
      <Badge
        variant="default"
        className={cn(dense && "px-1.5 py-0 text-[10px]")}
      >
        {snapshotScopeLabel(snapshot)}
      </Badge>
      {!snapshot.eligibleForHistory ? (
        <Badge
          variant="danger"
          className={cn(dense && "px-1.5 py-0 text-[10px]")}
        >
          {ZD_ESTIMATE_UI.snapshotsDisabledBadge}
        </Badge>
      ) : null}
    </div>
  );
}

function formatDelta(value: number | null): {
  text: string;
  tone: "neutral" | "up" | "down";
} {
  if (value == null) return { text: "—", tone: "neutral" };
  const text = formatQty(value);
  if (value > 0) return { text: `+${text}`, tone: "up" };
  if (value < 0) return { text, tone: "down" };
  return { text, tone: "neutral" };
}

export function ZdEstimateSnapshotsModal({
  open,
  onClose,
  onError,
  onHistoryEligibilityChanged,
}: {
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
  /** Po włączeniu/wyłączeniu snapshotu z cutu — parent może wymusić re-Policz. */
  onHistoryEligibilityChanged?: () => void;
}) {
  const [pending, start] = useTransition();
  const [snapshots, setSnapshots] = useState<ZdEstimateOrderSnapshotRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lines, setLines] = useState<ZdEstimateOrderSnapshotLineRow[]>([]);
  const [linesPending, setLinesPending] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleClose = () => {
    setSelectedId(null);
    setLines([]);
    setLinesPending(false);
    setLoadError(null);
    setToggling(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    start(async () => {
      const res = await actionListZdEstimateSnapshots();
      if (cancelled) return;
      if (!res.ok) {
        setLoadError(res.message);
        setSnapshots([]);
        setSelectedId(null);
        return;
      }
      setLoadError(null);
      setSnapshots(res.snapshots);
      setSelectedId((prev) => {
        if (prev && res.snapshots.some((s) => s.id === prev)) return prev;
        return res.snapshots[0]?.id ?? null;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLines([]);
      setLinesPending(true);
    });
    void actionGetZdEstimateSnapshotLines({ snapshotId: selectedId }).then(
      (res) => {
        if (cancelled) return;
        setLinesPending(false);
        if (!res.ok) {
          onError(res.message);
          setLines([]);
          return;
        }
        setLines(res.lines);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [open, selectedId, onError]);

  const selected = snapshots.find((s) => s.id === selectedId) ?? null;
  const listLoading = pending && snapshots.length === 0 && !loadError;
  const showLines = Boolean(selectedId);
  const visibleLines = showLines ? lines : [];
  const visibleLinesPending = showLines && linesPending;

  const toggleEligibility = () => {
    if (!selected || toggling) return;
    const nextEligible = !selected.eligibleForHistory;
    setToggling(true);
    start(async () => {
      const res = await actionSetZdEstimateSnapshotHistoryEligible({
        snapshotId: selected.id,
        eligible: nextEligible,
      });
      setToggling(false);
      if (!res.ok) {
        onError(res.message);
        return;
      }
      setSnapshots((prev) =>
        prev.map((s) =>
          s.id === selected.id
            ? { ...s, eligibleForHistory: nextEligible }
            : s
        )
      );
      onHistoryEligibilityChanged?.();
    });
  };

  return (
    <ModalShell
      open={open}
      onClose={handleClose}
      title={ZD_ESTIMATE_UI.snapshotsModalTitle}
      titleHint={ZD_ESTIMATE_UI.snapshotsModalHint}
      titleHintAriaLabel="O historii powiązań ZD"
      size="xl"
      bodyClassName="px-5 py-4 sm:px-6 sm:py-5"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-snug text-slate-500">
            {listLoading
              ? ZD_ESTIMATE_UI.snapshotsLoadingList
              : loadError
                ? "—"
                : snapshots.length === 0
                  ? ZD_ESTIMATE_UI.snapshotsModalEmptyTitle
                  : zdEstimateSnapshotsFooterCount(snapshots.length)}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            className="self-end sm:self-auto"
          >
            {ZD_ESTIMATE_UI.snapshotsCloseCta}
          </Button>
        </div>
      }
    >
      {listLoading ? (
        <div
          className="flex flex-col items-center justify-center gap-3 py-14"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <Spinner />
          <p className="text-sm text-slate-500">
            {ZD_ESTIMATE_UI.snapshotsLoadingList}
          </p>
        </div>
      ) : loadError ? (
        <Alert tone="error" title={ZD_ESTIMATE_UI.snapshotsModalLoadErrorTitle}>
          {loadError}
        </Alert>
      ) : snapshots.length === 0 ? (
        <EmptyState
          title={ZD_ESTIMATE_UI.snapshotsModalEmptyTitle}
          description={ZD_ESTIMATE_UI.snapshotsModalEmptyDescription}
          icon={<IconLink size={28} strokeWidth={1.75} />}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)] lg:gap-5">
          <section
            aria-label={ZD_ESTIMATE_UI.snapshotsModalListHeading}
            className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {ZD_ESTIMATE_UI.snapshotsModalListHeading}
              </p>
              <span className="text-[11px] tabular-nums text-slate-400">
                {snapshots.length}
              </span>
            </div>
            <ul className="max-h-[min(22rem,42vh)] space-y-0.5 overflow-y-auto p-1.5 sm:max-h-[min(28rem,52vh)]">
              {snapshots.map((s) => {
                const active = selectedId === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      aria-current={active ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg px-2.5 py-2.5 text-left transition",
                        active
                          ? "bg-indigo-50 ring-1 ring-indigo-200/90"
                          : "hover:bg-slate-50",
                        !s.eligibleForHistory && !active && "opacity-70"
                      )}
                    >
                      <span
                        className={cn(
                          "block truncate text-sm font-semibold tracking-tight",
                          active ? "text-indigo-950" : "text-slate-900"
                        )}
                      >
                        {snapshotDokLabel(s)}
                      </span>
                      <span className="mt-1 block text-[11px] tabular-nums text-slate-500">
                        {snapshotLinkedLabel(s.linkedAt)}
                      </span>
                      <div className="mt-1.5">
                        <SnapshotMetaBadges snapshot={s} dense />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            aria-label={
              selected
                ? snapshotDokLabel(selected)
                : ZD_ESTIMATE_UI.snapshotsModalSelectHint
            }
            className="flex min-h-[16rem] min-w-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white"
          >
            {!selected ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 flex size-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <IconLink size={22} strokeWidth={1.75} />
                </div>
                <p className="max-w-sm text-sm leading-relaxed text-slate-600">
                  {ZD_ESTIMATE_UI.snapshotsModalSelectHint}
                </p>
              </div>
            ) : (
              <>
                <div className="shrink-0 space-y-3 border-b border-slate-100 px-4 py-3.5 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">
                        {snapshotDokLabel(selected)}
                      </h3>
                      <p className="text-[12px] tabular-nums text-slate-500">
                        Powiązano {snapshotLinkedLabel(selected.linkedAt)}
                      </p>
                      <SnapshotMetaBadges snapshot={selected} />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={
                        selected.eligibleForHistory ? "secondary" : "primary"
                      }
                      disabled={pending || toggling}
                      onClick={toggleEligibility}
                      className="shrink-0"
                    >
                      {selected.eligibleForHistory
                        ? ZD_ESTIMATE_UI.snapshotsDisableHistoryCta
                        : ZD_ESTIMATE_UI.snapshotsEnableHistoryCta}
                    </Button>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    {ZD_ESTIMATE_UI.snapshotsModalLinesCaption}
                  </p>
                </div>

                <div className="min-h-0 flex-1">
                  {visibleLinesPending ? (
                    <div
                      className="flex flex-col items-center justify-center gap-2 py-12"
                      role="status"
                      aria-live="polite"
                      aria-busy="true"
                    >
                      <Spinner size="sm" />
                      <p className="text-xs text-slate-500">
                        {ZD_ESTIMATE_UI.snapshotsLoadingLines}
                      </p>
                    </div>
                  ) : visibleLines.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-slate-500">
                      {ZD_ESTIMATE_UI.snapshotsModalLinesEmpty}
                    </p>
                  ) : (
                    <div className="flex h-full min-h-0 flex-col">
                      <div className="max-h-[min(22rem,46vh)] overflow-auto sm:max-h-[min(26rem,50vh)]">
                        <table className="w-full min-w-[28rem] border-collapse text-left text-[12px]">
                          <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm">
                            <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              <th className="px-4 py-2.5 sm:px-5">
                                {ZD_ESTIMATE_UI.snapshotsColSymbol}
                              </th>
                              <th className="px-2 py-2.5">
                                {ZD_ESTIMATE_UI.snapshotsColName}
                              </th>
                              <th className="px-2 py-2.5 text-right">
                                {ZD_ESTIMATE_UI.snapshotsColQty}
                              </th>
                              <th className="px-2 py-2.5 text-right">
                                {ZD_ESTIMATE_UI.snapshotsColTarget}
                              </th>
                              <th className="px-4 py-2.5 text-right sm:px-5">
                                {ZD_ESTIMATE_UI.snapshotsColDelta}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleLines.map((l) => {
                              const delta = formatDelta(l.deltaAtLink);
                              return (
                                <tr
                                  key={l.id}
                                  className="border-b border-slate-100 last:border-b-0"
                                >
                                  <td className="whitespace-nowrap px-4 py-2 font-medium text-slate-900 sm:px-5">
                                    {l.twSymbol?.trim() || "—"}
                                  </td>
                                  <td className="max-w-[14rem] truncate px-2 py-2 text-slate-600">
                                    {l.twNazwa}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-800">
                                    {formatQty(l.qty)}
                                  </td>
                                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-600">
                                    {l.celAtLink != null
                                      ? formatQty(l.celAtLink)
                                      : "—"}
                                  </td>
                                  <td
                                    className={cn(
                                      "whitespace-nowrap px-4 py-2 text-right tabular-nums sm:px-5",
                                      delta.tone === "up" &&
                                        "font-medium text-emerald-700",
                                      delta.tone === "down" &&
                                        "font-medium text-rose-700",
                                      delta.tone === "neutral" &&
                                        "text-slate-600"
                                    )}
                                  >
                                    {delta.text}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-2 sm:px-5">
                        <p className="text-[11px] tabular-nums text-slate-500">
                          {zdEstimateSnapshotsLinesCount(visibleLines.length)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </ModalShell>
  );
}
