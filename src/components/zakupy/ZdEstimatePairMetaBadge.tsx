"use client";

import type { ReactNode } from "react";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import {
  formatPairPiecesUiHint,
  formatPairSalesChannelsBreakdown,
} from "@/lib/orders/zd-product-pair-units";
import { cn } from "@/lib/cn";

/**
 * Badge pod nazwą: sprzedaż/pokrycie pary w sztukach + rozbicie kanałów.
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
      ) : (
        <span className="truncate text-[10px] font-medium normal-case tracking-normal text-slate-600">
          <span className="tabular-nums text-slate-800">
            {sales.piecesLabel}
          </span>
          <span className="text-slate-400"> sprz. · </span>
          <span className="tabular-nums text-slate-800">
            {cover.piecesLabel}
          </span>
          <span className="text-slate-400">
            {" "}
            {ZD_ESTIMATE_UI.pairCoverLabel}
          </span>
        </span>
      )}
    </span>
  );
}

/** Komórka Cel: wartości popytu w sztukach + przybliżenie op. */
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
  const hint = formatPairPiecesUiHint(pieces, unitsPerPack, formatQty);
  return (
    <span
      className="inline-flex flex-col items-end gap-0.5"
      title={hint.title}
    >
      <span
        className={cn(
          "tabular-nums leading-none",
          emphasize ? "font-semibold text-slate-900" : "text-slate-700"
        )}
      >
        {hint.piecesLabel}
      </span>
      {hint.packsApproxLabel ? (
        <span className="text-[10px] font-medium leading-snug text-indigo-800/85">
          {hint.packsApproxLabel}
        </span>
      ) : null}
      {subline}
    </span>
  );
}

/**
 * Kolumna Sprzedaż dla pary: łącznie w sztukach + rozbicie obu kanałów
 * (żeby nie wyglądało jak „ta sama sprzedaż na sztukach i kartonach”).
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
  const totalHint = formatPairPiecesUiHint(
    pair.sprzedazSzt,
    pair.unitsPerPack,
    formatQty
  );

  return (
    <span
      className="inline-flex max-w-[10rem] flex-col items-end gap-0.5"
      title={channels.title}
    >
      <span className="tabular-nums leading-none text-slate-800">
        <span className="font-semibold">{totalHint.piecesLabel}</span>
      </span>
      {totalHint.packsApproxLabel ? (
        <span className="text-[10px] font-medium leading-snug text-indigo-800/85">
          {totalHint.packsApproxLabel}
        </span>
      ) : null}
      <span className="max-w-full truncate text-right text-[10px] font-medium leading-snug text-slate-500">
        {channels.channelsLabel}
      </span>
    </span>
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
      className="inline-flex flex-col items-end gap-0.5"
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
