"use client";

import type { ReactNode } from "react";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import {
  formatPairPiecesUiHint,
  formatPairSalesChannelsBreakdown,
  normalizeUnitsPerPack,
} from "@/lib/orders/zd-product-pair-units";
import { cn } from "@/lib/cn";

/**
 * Wspólny stack metryki w sztukach (Sprzed. / Cel):
 * liczba + „szt” w jednej linii, opcjonalnie ≈ op. pod spodem, potem sublinie.
 * Wyrównanie do prawej, ale całość jako jeden blok — linie pod sobą, nie „uciekają”.
 */
export function ZdEstimatePiecesMetricCell({
  pieces,
  unitsPerPack,
  emphasize,
  title,
  subline,
  footer,
}: {
  pieces: number;
  /** ≥2 → pokaż przybliżenie w op. (para lub opakowanie). */
  unitsPerPack?: number | null;
  emphasize?: boolean;
  title?: string;
  subline?: ReactNode;
  footer?: ReactNode;
}) {
  const ratio = normalizeUnitsPerPack(unitsPerPack ?? null);
  const hint = formatPairPiecesUiHint(pieces, ratio ?? 1, formatQty);
  const fullTitle = title ?? hint.title;

  return (
    <span
      className="zd-estimate-metric-stack inline-flex w-full min-w-0 max-w-full flex-col items-end gap-0.5 text-right"
      title={fullTitle}
    >
      <span className="leading-none">
        <span
          className={cn(
            "tabular-nums tracking-tight",
            emphasize ? "font-semibold text-slate-900" : "font-medium text-slate-800"
          )}
        >
          {formatQty(Math.max(0, Number(pieces) || 0))}
        </span>
        <span className="ml-0.5 text-[10px] font-medium text-slate-400">szt</span>
      </span>
      {hint.packsApproxLabel ? (
        <span className="text-[10px] font-medium leading-tight text-indigo-800/90 tabular-nums">
          {hint.packsApproxLabel}
        </span>
      ) : null}
      {subline ? (
        <span className="flex w-full min-w-0 flex-col items-end gap-px">
          {subline}
        </span>
      ) : null}
      {footer}
    </span>
  );
}

/**
 * Badge pod nazwą: rola pary (paczka/sztuki) + konflikt opakowania.
 * Sprzedaż / pokrycie są w kolumnach Sprzed. i Cel (tooltip ma pełny kontekst).
 */
export function ZdEstimatePairMetaBadge({
  pair,
  packagingConflict,
}: {
  pair: ZdEstimatePairMeta;
  packagingConflict?: boolean;
}) {
  const sales = formatPairPiecesUiHint(
    pair.sprzedazSzt,
    pair.unitsPerPack,
    formatQty
  );
  const cover = formatPairPiecesUiHint(
    pair.coverSzt,
    pair.unitsPerPack,
    formatQty
  );
  const channels = formatPairSalesChannelsBreakdown(
    {
      pieceSprzedaz: pair.pieceSprzedaz,
      packSprzedaz: pair.packSprzedaz,
      unitsPerPack: pair.unitsPerPack,
      sprzedazSzt: pair.sprzedazSzt,
    },
    formatQty
  );
  const isPack = pair.role === "pack";

  const title = pair.partnerMissing
    ? "Brak partnera w wyniku szacunku — ilość 0"
    : [
        isPack
          ? "SKU paczki: na ZD zamawiasz ten towar (op./kartony)."
          : "SKU sztuk: sprzedaż jednostkowa — nie zamawiasz tego wiersza na ZD.",
        `1 op. = ${pair.unitsPerPack} szt.`,
        `Sprzedaż pary: ${sales.piecesLabel}${sales.packsApproxLabel ? ` (${sales.packsApproxLabel})` : ""}.`,
        channels.title,
        `Pokrycie pary: ${cover.piecesLabel}${cover.packsApproxLabel ? ` (${cover.packsApproxLabel})` : ""}.`,
        `Stany: sztuki ${formatQty(pair.pieceDostepne)} dost. · paczki ${formatQty(pair.packDostepne)} op. ×${pair.unitsPerPack}.`,
      ].join(" ");

  return (
    <span
      className={cn(
        "flex max-w-[min(100%,22rem)] flex-col gap-0.5 rounded-md px-1.5 py-1 text-left ring-1",
        pair.partnerMissing
          ? "bg-amber-50 text-amber-950 ring-amber-100"
          : isPack
            ? "bg-indigo-50/90 text-indigo-950 ring-indigo-100"
            : "bg-sky-50 text-sky-950 ring-sky-100"
      )}
      title={title}
    >
      <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide">
        <span
          className={cn(
            "rounded px-1 py-px",
            isPack
              ? "bg-indigo-200/70 text-indigo-950"
              : "bg-sky-200/70 text-sky-950"
          )}
        >
          {isPack ? "Paczka" : "Sztuki"}
        </span>
        <span className="font-medium normal-case tracking-normal text-slate-600">
          {pair.unitsPerPack} szt/op.
        </span>
        {isPack ? (
          <span className="rounded bg-emerald-100/80 px-1 py-px font-semibold normal-case tracking-normal text-emerald-900">
            na ZD
          </span>
        ) : (
          <span className="rounded bg-slate-200/80 px-1 py-px font-medium normal-case tracking-normal text-slate-700">
            nie na ZD
          </span>
        )}
        {packagingConflict ? (
          <span
            className="rounded bg-amber-100 px-1 py-px font-semibold normal-case tracking-normal text-amber-950"
            title={ZD_ESTIMATE_UI.packagingConflictTitle}
          >
            {ZD_ESTIMATE_UI.packagingConflictShort}
          </span>
        ) : null}
      </span>

      {pair.partnerMissing ? (
        <span className="text-[10px] font-medium normal-case tracking-normal text-amber-900">
          Brak partnera — ilość 0
        </span>
      ) : null}
    </span>
  );
}

/** Komórka Cel (i inne metryki sztuk): stack szt → ≈ op. → delta. */
export function ZdEstimatePairPiecesCell({
  pieces,
  unitsPerPack,
  emphasize,
  subline,
}: {
  pieces: number;
  unitsPerPack: number;
  emphasize?: boolean;
  subline?: ReactNode;
}) {
  return (
    <ZdEstimatePiecesMetricCell
      pieces={pieces}
      unitsPerPack={unitsPerPack}
      emphasize={emphasize}
      subline={subline}
    />
  );
}

/**
 * Kolumna Sprzedaż dla pary: łącznie w sztukach + ≈ op. + kanały pod spodem
 * (osobne linie — bez jednej uciętej ściany „50 szt + 2 op. …”).
 */
export function ZdEstimatePairSalesCell({
  pair,
}: {
  pair: ZdEstimatePairMeta;
}) {
  const channels = formatPairSalesChannelsBreakdown(
    {
      pieceSprzedaz: pair.pieceSprzedaz,
      packSprzedaz: pair.packSprzedaz,
      unitsPerPack: pair.unitsPerPack,
      sprzedazSzt: pair.sprzedazSzt,
    },
    formatQty
  );

  return (
    <ZdEstimatePiecesMetricCell
      pieces={pair.sprzedazSzt}
      unitsPerPack={pair.unitsPerPack}
      title={channels.title}
      footer={
        channels.channelLines.length > 0 ? (
          <span className="mt-0.5 flex w-full min-w-0 flex-col items-end gap-px border-t border-slate-200/70 pt-0.5">
            {channels.channelLines.map((line) => (
              <span
                key={line}
                className="max-w-full text-[10px] font-medium leading-tight text-slate-500 tabular-nums"
              >
                {line}
              </span>
            ))}
          </span>
        ) : null
      }
    />
  );
}

/** Stan / rez. / dostępne na SKU paczki — jednostki karty = op. */
export function ZdEstimatePairPackStockCell({
  value,
  tone,
}: {
  value: number;
  tone?: "default" | "muted" | "warn";
}) {
  return (
    <span
      className="inline-flex w-full min-w-0 flex-col items-end gap-0.5 text-right"
      title={`${formatQty(value)} op. na karcie paczki (nie sztuki demontażu)`}
    >
      <span
        className={cn(
          "tabular-nums leading-none",
          tone === "warn"
            ? "font-medium text-amber-800"
            : tone === "muted"
              ? "text-slate-400"
              : "text-slate-700"
        )}
      >
        {formatQty(value)}
      </span>
      <span className="text-[10px] font-medium leading-none text-slate-400">
        op.
      </span>
    </span>
  );
}
