"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/cn";
import { salesTypography } from "@/lib/ui/ontime-theme";
import { actionFetchZkWatchTeethPreview } from "@/app/actions/my-orders";
import { formatShortDate } from "@/lib/sales/notepad-format";
import {
  ZK_TEETH_TONE_BADGE_CLASS,
  type ZkTeethPreviewRow,
} from "@/lib/sales/zk-watch-teeth-preview";
import { ZK_MODAL_SECTION_HINTS, ZK_MODAL_SECTION_TITLES } from "@/lib/sales/zk-modal-section-copy";
import { ZkWatchModalSection } from "./ZkWatchModalSection";
import type { SalesZkWatch } from "@/types/database";

const JAW_LABELS: Record<string, string> = {
  upper: "Górna",
  lower: "Dolna",
};

const KIND_LABELS: Record<string, string> = {
  anterior: "Przedni",
  posterior: "Tylny",
};

export function ZkWatchTeethPreviewSection({
  watch,
  tourPreview = false,
  readOnly = false,
}: {
  watch: SalesZkWatch;
  tourPreview?: boolean;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<ZkTeethPreviewRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (signal?: AbortSignal) => {
    if (tourPreview) return;
    setLoading(true);
    setError(null);
    try {
      const result = await actionFetchZkWatchTeethPreview(watch.id);
      if (signal?.aborted) return;
      if (result.success) {
        setRows(result.rows);
      } else {
        setError("Nie udało się pobrać danych zębów.");
      }
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Nie udało się pobrać danych zębów.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [watch.id, tourPreview]);

  useEffect(() => {
    if (tourPreview) return;
    const controller = new AbortController();
    const signal = controller.signal;
    queueMicrotask(() => {
      if (!signal.aborted) void fetchRows(signal);
    });
    return () => controller.abort();
  }, [fetchRows, tourPreview]);

  if (tourPreview) return null;

  if (loading && rows === null) {
    return (
      <ZkWatchModalSection
        title={ZK_MODAL_SECTION_TITLES.teeth}
        hint={ZK_MODAL_SECTION_HINTS.teeth}
      >
        <div className={cn(salesTypography.rowBody, "flex items-center gap-2 py-3")}>
          <Spinner size="sm" />
          Ładowanie zębów…
        </div>
      </ZkWatchModalSection>
    );
  }

  if (error) {
    return (
      <ZkWatchModalSection
        title={ZK_MODAL_SECTION_TITLES.teeth}
        hint={ZK_MODAL_SECTION_HINTS.teeth}
      >
        <div className="rounded-md border border-red-200/80 bg-red-50/60 px-3 py-2.5 text-sm text-red-800">
          <p>{error}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => void fetchRows()}
          >
            Spróbuj ponownie
          </Button>
        </div>
      </ZkWatchModalSection>
    );
  }

  if (rows && rows.length === 0) {
    return null;
  }

  return (
    <ZkWatchModalSection
      title={ZK_MODAL_SECTION_TITLES.teeth}
      hint={ZK_MODAL_SECTION_HINTS.teeth}
    >
      <div className="overflow-x-auto rounded-md border border-slate-200/90">
        <table className="w-full text-sm" aria-label="Zęby powiązane z ZK — status zamówienia">
          <thead>
            <tr className="border-b border-slate-200/90 bg-slate-50/80 text-left text-xs font-medium text-slate-600">
              <th className="px-2.5 py-1.5">Kolor</th>
              <th className="px-2.5 py-1.5">Wzór</th>
              <th className="px-2.5 py-1.5">Rozmiar</th>
              <th className="px-2.5 py-1.5">Szczęka</th>
              <th className="px-2.5 py-1.5">Typ</th>
              <th className="px-2.5 py-1.5">Termin dostawy</th>
              <th className="px-2.5 py-1.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows?.map((row, i) => (
              <tr
                key={`${row.orderId}-${row.position}-${i}`}
                className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/50"
              >
                <td className={cn(salesTypography.rowTitle, "px-2.5 py-1.5 text-slate-800")}>
                  {row.color || "—"}
                </td>
                <td className={cn(salesTypography.rowBody, "px-2.5 py-1.5 text-slate-700")}>
                  {row.mould ?? "—"}
                </td>
                <td className={cn(salesTypography.rowBody, "px-2.5 py-1.5 text-slate-700")}>
                  {row.size ?? "—"}
                </td>
                <td className={cn(salesTypography.rowBody, "px-2.5 py-1.5 text-slate-700")}>
                  {row.jaw ? JAW_LABELS[row.jaw] ?? row.jaw : "—"}
                </td>
                <td className={cn(salesTypography.rowBody, "px-2.5 py-1.5 text-slate-700")}>
                  {row.kind ? KIND_LABELS[row.kind] ?? row.kind : "—"}
                </td>
                <td className={cn(salesTypography.rowMeta, "whitespace-nowrap px-2.5 py-1.5 text-slate-600")}>
                  {formatShortDate(row.teethDeliveryDate) ?? "—"}
                </td>
                <td className="px-2.5 py-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      ZK_TEETH_TONE_BADGE_CLASS[row.statusTone]
                    )}
                  >
                    {row.statusLabel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end pt-1.5">
        {!readOnly ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void fetchRows()}
            disabled={loading}
          >
            {loading ? "Odświeżanie…" : "Odśwież"}
          </Button>
        ) : null}
      </div>
    </ZkWatchModalSection>
  );
}
