"use client";

import type { ReactNode } from "react";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePairMeta } from "@/lib/orders/zd-estimate-pairs";
import { formatZdEstimateTableQty } from "@/lib/orders/zd-estimate-table-qty";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import {
  formatPairPiecesUiHint,
  formatPairSalesChannelsBreakdown,
  normalizeUnitsPerPack,
} from "@/lib/orders/zd-product-pair-units";
import {
  formatWzSalesSubline,
  formatWzSalesTitle,
} from "@/lib/orders/zd-estimate-wz-sales-ui";
import { cn } from "@/lib/cn";
import type { ZdEstimateQtyTier } from "@/components/zakupy/ZdEstimateQtyValue";
import { ZdEstimateStatusBadge } from "@/components/zakupy/ZdEstimateStatusBadge";

/** Dopisek „w tym WZ N” — `null` gdy brak (używaj jako `subline={render…(wz)}`). */
export function renderZdEstimateWzSalesSubline(
  wzNiepowiazane: unknown
): ReactNode {
  const wzSub = formatWzSalesSubline(wzNiepowiazane, formatQty);
  if (!wzSub) return null;
  return (
    <span className="zd-est-metric-subline zd-est-metric-subline--wz text-[10px] font-medium leading-tight text-sky-700/90">
      {wzSub}
    </span>
  );
}

/**
 * Metryka w sztukach (Sprzed. / Cel / …).
 * Przybliżenie w opakowaniach zostaje tylko w tooltipie — nie w komórce,
 * żeby nie mieszać się z kolumną „Opak.” i ilościami magazynowymi.
 */
export function ZdEstimatePiecesMetricCell({
  pieces,
  unitsPerPack,
  tier = "c",
  title,
  subline,
  footer,
  zeroAsDash = false,
}: {
  pieces: number;
  /** ≥2 → dopisek ≈ op. w title (tooltip). */
  unitsPerPack?: number | null;
  /** b = Cel, c = Sprzed. */
  tier?: ZdEstimateQtyTier;
  title?: string;
  subline?: ReactNode;
  footer?: ReactNode;
  /** Sprzed.: 0 → „—”. Cel/Dost. zawsze cyfra. */
  zeroAsDash?: boolean;
}) {
  const raw = Math.max(0, Number(pieces) || 0);
  const ratio = normalizeUnitsPerPack(unitsPerPack ?? null);
  const hint = formatPairPiecesUiHint(raw, ratio ?? 1, formatQty);
  const fullTitle = title ?? hint.title;
  const showDash = zeroAsDash && raw < 1e-9;
  const qtyClass = tier === "b" ? "zd-est-qty--b" : "zd-est-qty--c";

  return (
    <span
      className="zd-estimate-metric-stack inline-flex w-full min-w-0 max-w-full flex-col items-center gap-0.5 text-center"
      title={fullTitle}
    >
      <span className="inline-flex max-w-full items-baseline justify-center gap-0.5 leading-none">
        {showDash ? (
          <span className={cn(qtyClass, "zd-est-qty--dash")}>—</span>
        ) : (
          <>
            <span className={cn("min-w-0 truncate", qtyClass)}>
              {formatZdEstimateTableQty(raw)}
            </span>
            <span className="zd-est-unit shrink-0">szt</span>
          </>
        )}
      </span>
      {!showDash && subline ? (
        <span className="flex w-full min-w-0 flex-col items-center gap-px">
          {subline}
        </span>
      ) : null}
      {footer}
    </span>
  );
}

/**
 * Badge pary w kolumnie Status — kompaktowa 1 linia; szczegóły w title.
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
        packagingConflict ? ZD_ESTIMATE_UI.packagingConflictTitle : null,
      ]
        .filter(Boolean)
        .join(" ");

  const meta = pair.partnerMissing
    ? "brak"
    : packagingConflict
      ? "konflikt"
      : `×${pair.unitsPerPack}`;

  return (
    <ZdEstimateStatusBadge
      kind={isPack ? "Paczka" : "Sztuki"}
      meta={meta}
      tone={
        pair.partnerMissing || packagingConflict
          ? "amber"
          : isPack
            ? "indigo"
            : "sky"
      }
      title={title}
    />
  );
}

/** Komórka Cel (i inne metryki sztuk): szt (+ delta); ≈ op. tylko w tooltip. */
export function ZdEstimatePairPiecesCell({
  pieces,
  unitsPerPack,
  subline,
  role = "pack",
}: {
  pieces: number;
  unitsPerPack: number;
  subline?: ReactNode;
  /** Piece: cel pary tylko na paczce — dash + tooltip. */
  role?: "pack" | "piece";
}) {
  if (role === "piece") {
    return (
      <ZdEstimatePiecesMetricCell
        pieces={0}
        unitsPerPack={unitsPerPack}
        tier="b"
        zeroAsDash
        title="Cel zapasu pary jest na wierszu paczki (tu nie zamawiasz sztuk luzem)."
      />
    );
  }
  return (
    <ZdEstimatePiecesMetricCell
      pieces={pieces}
      unitsPerPack={unitsPerPack}
      tier="b"
      subline={subline}
    />
  );
}

/**
 * Kolumna Sprzedaż dla pary: sztuki; kanały i ≈ op. tylko w tooltip.
 * Paczka: łącznie (Do ZD). Piece: dash — bez 2× w sumie kolumny.
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
  const packHint = formatPairPiecesUiHint(
    pair.sprzedazSzt,
    pair.unitsPerPack,
    formatQty
  );

  if (pair.role === "piece") {
    return (
      <ZdEstimatePiecesMetricCell
        pieces={0}
        unitsPerPack={pair.unitsPerPack}
        tier="c"
        zeroAsDash
        title={[
          `Sprzedaż pary łącznie ${formatQty(pair.sprzedazSzt)} szt jest na wierszu paczki (Do ZD).`,
          `Tu luzem (info): ${formatQty(pair.pieceSprzedaz)} szt — nie doliczane drugi raz.`,
          channels.title,
        ].join(" ")}
      />
    );
  }

  const title = formatWzSalesTitle({
    sprzedazOkres: pair.sprzedazSzt,
    wzNiepowiazaneOkres: pair.wzNiepowiazaneSzt,
    formatQty,
    extraParts: [channels.title, packHint.packsApproxLabel],
  });

  return (
    <ZdEstimatePiecesMetricCell
      pieces={pair.sprzedazSzt}
      unitsPerPack={pair.unitsPerPack}
      tier="c"
      title={title}
      zeroAsDash
      subline={renderZdEstimateWzSalesSubline(pair.wzNiepowiazaneSzt)}
    />
  );
}

/** Stan / rez. / dostępne na SKU paczki — jednostki karty = op. */
export function ZdEstimatePairPackStockCell({
  value,
  tier = "d",
  tone,
  zeroAsDash = false,
}: {
  value: number;
  tier?: ZdEstimateQtyTier;
  tone?: "default" | "muted" | "warn";
  zeroAsDash?: boolean;
}) {
  const qtyClass =
    tier === "b" ? "zd-est-qty--b" : tier === "c" ? "zd-est-qty--c" : "zd-est-qty--d";
  const showDash = zeroAsDash && Number.isFinite(value) && Math.abs(value) < 1e-9;

  return (
    <span
      className="inline-flex w-full min-w-0 items-baseline justify-center gap-0.5 text-center leading-none"
      title={`${formatQty(value)} op. na karcie paczki (nie sztuki demontażu)`}
    >
      {showDash ? (
        <span className={cn(qtyClass, "zd-est-qty--dash")}>—</span>
      ) : (
        <>
          <span
            className={cn(
              qtyClass,
              tone === "warn" && "zd-est-qty--warn",
              tone === "muted" && "zd-est-qty--muted"
            )}
          >
            {formatZdEstimateTableQty(value)}
          </span>
          <span className="zd-est-unit shrink-0">op.</span>
        </>
      )}
    </span>
  );
}
