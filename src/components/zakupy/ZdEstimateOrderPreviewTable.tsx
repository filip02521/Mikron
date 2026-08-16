"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdCreatePreviewLine } from "@/lib/orders/zd-estimate-create-zd";
import type { ZdPostCreateLineSnap } from "@/lib/orders/zd-estimate-post-create";
import { controlFocusClass, panelTypography } from "@/lib/ui/ontime-theme";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";

export type ZdEstimateOrderPreviewRow = ZdCreatePreviewLine;

export function orderPreviewRowsFromSnap(
  lines: readonly ZdPostCreateLineSnap[]
): ZdEstimateOrderPreviewRow[] {
  return lines.map((l) => ({
    twId: l.twId,
    symbol: l.symbol,
    nazwa: l.nazwa,
    plu: l.plu,
    ilosc: l.ilosc,
    packagingHint: l.packagingHint,
    individualExtraPieces: l.individualExtraPieces || undefined,
    extraOnly: l.extraOnly || undefined,
    piecesArriving: l.piecesArriving,
    unitsPerPackage: l.unitsPerPackage,
    documentUnitMode: l.documentUnitMode,
    roundupNeed: l.roundupNeed,
    roundupArrive: l.roundupArrive,
    celZapasuTracked: l.celAtLink,
    salesTrackDelta: l.deltaAtLink,
    bomOrPairLabel: l.bomOrPairLabel,
  }));
}

function formatDelta(n: number | undefined): string {
  const v = Number(n) || 0;
  if (v === 0) return "0";
  return v > 0 ? `+${formatQty(v)}` : formatQty(v);
}

export function ZdEstimateOrderPreviewTable({
  lines,
  className,
  compact = false,
  extrasPolicy = "sum",
}: {
  lines: readonly ZdEstimateOrderPreviewRow[];
  className?: string;
  compact?: boolean;
  /** Wpływa tylko na etykietę „+prośba” vs „prośba” (max nie dubluje). */
  extrasPolicy?: "sum" | "max";
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return lines;
    return lines.filter((l) => {
      const hay = `${l.symbol} ${l.plu ?? ""} ${l.nazwa}`.toLowerCase();
      return hay.includes(q);
    });
  }, [lines, q]);

  const zdUnitsSuma = lines.reduce((s, l) => s + (Number(l.ilosc) || 0), 0);
  const piecesSuma = lines.reduce((s, l) => {
    const p = l.piecesArriving;
    return s + (p != null && Number.isFinite(p) ? p : 0);
  }, 0);
  const extraCount = lines.filter(
    (l) => (l.individualExtraPieces ?? 0) > 0
  ).length;
  const showFilter = lines.length >= 200;

  if (!lines.length) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn(panelTypography.sectionLabel, "text-slate-700")}>
          {lines.length} {ZD_ESTIMATE_UI.postCreatePreviewScrollHint}
        </p>
        {showFilter ? (
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ZD_ESTIMATE_UI.postCreateSearchPlaceholder}
            className={cn(
              controlFocusClass,
              "w-full min-w-[12rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm sm:w-64"
            )}
          />
        ) : null}
      </div>
      {q && filtered.length !== lines.length ? (
        <p className="text-xs text-slate-500">
          Widoczne {filtered.length} z {lines.length}
        </p>
      ) : null}
      <div
        className={cn(
          "overflow-x-auto rounded-xl border border-slate-200/90",
          compact
            ? "max-h-[min(40vh,22rem)] overflow-y-auto"
            : "max-h-[min(50vh,28rem)] overflow-y-auto"
        )}
      >
        <table
          className={cn(
            "w-full text-left text-sm",
            compact ? "min-w-[28rem]" : "min-w-[48rem]"
          )}
        >
          <thead className="sticky top-0 z-[1] bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-2.5 py-2 font-medium">Lp</th>
              <th className="px-2.5 py-2 font-medium">Symbol</th>
              {!compact ? (
                <th className="px-2.5 py-2 font-medium">PLU</th>
              ) : null}
              <th className="px-2.5 py-2 font-medium">Nazwa</th>
              <th className="px-2.5 py-2 text-right font-medium">Na ZD</th>
              {!compact ? (
                <>
                  <th className="px-2.5 py-2 text-right font-medium">Cel</th>
                  <th className="px-2.5 py-2 text-right font-medium">Delta</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l, i) => (
              <tr key={l.twId} className="border-t border-slate-100 align-top">
                <td className="px-2.5 py-1.5 tabular-nums text-slate-400">
                  {i + 1}
                </td>
                <td className="px-2.5 py-1.5 font-mono text-xs text-slate-700">
                  {l.symbol || "—"}
                </td>
                {!compact ? (
                  <td className="px-2.5 py-1.5 font-mono text-xs text-slate-500">
                    {l.plu?.trim() || "—"}
                  </td>
                ) : null}
                <td className="px-2.5 py-1.5 text-slate-800">
                  <span className="whitespace-normal break-words">{l.nazwa}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {l.bomOrPairLabel ? (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-800">
                        {l.bomOrPairLabel}
                      </span>
                    ) : null}
                    {(l.individualExtraPieces ?? 0) > 0 ? (
                      <span className="text-[10px] font-semibold uppercase text-emerald-700">
                        {extrasPolicy === "max"
                          ? `prośba ${formatQty(l.individualExtraPieces ?? 0)} szt`
                          : `+prośba ${formatQty(l.individualExtraPieces ?? 0)} szt`}
                      </span>
                    ) : null}
                    {l.extraOnly ? (
                      <span className="text-[10px] font-medium uppercase text-amber-800">
                        tylko prośba
                      </span>
                    ) : null}
                    {compact && l.plu?.trim() ? (
                      <span className="font-mono text-[10px] text-slate-400">
                        PLU {l.plu.trim()}
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-2.5 py-1.5 text-right tabular-nums">
                  <div className="font-medium text-slate-900">{l.ilosc}</div>
                  {l.piecesArriving != null &&
                  l.piecesArriving !== l.ilosc ? (
                    <div className="text-[11px] text-slate-500">
                      {formatQty(l.piecesArriving)} szt
                    </div>
                  ) : null}
                  {l.packagingHint ? (
                    <div className="text-[11px] text-slate-400">
                      {l.packagingHint}
                    </div>
                  ) : null}
                  {l.roundupNeed != null &&
                  l.roundupArrive != null &&
                  l.roundupArrive > l.roundupNeed ? (
                    <div className="text-[11px] text-amber-800">
                      dobicie +{l.roundupArrive - l.roundupNeed} szt (
                      {l.roundupNeed}→{l.roundupArrive})
                    </div>
                  ) : null}
                </td>
                {!compact ? (
                  <>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                      {formatQty(l.celZapasuTracked ?? 0)}
                    </td>
                    <td className="px-2.5 py-1.5 text-right tabular-nums text-slate-700">
                      {formatDelta(l.salesTrackDelta)}
                    </td>
                  </>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-600">
        Suma dokumentu {formatQty(zdUnitsSuma)}
        {piecesSuma > 0 ? ` · ${formatQty(piecesSuma)} szt` : ""}
        {extraCount > 0
          ? ` · ${extraCount} ${extraCount === 1 ? "pozycja" : "pozycji"} z prośbą`
          : ""}
      </p>
    </div>
  );
}
