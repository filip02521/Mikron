"use client";

import { Fragment, memo } from "react";
import type { ZdEstimateOptionalColumn } from "@/lib/orders/zd-estimate-prefs";
import type { ZdEstimateExtrasPolicy } from "@/lib/orders/zd-estimate-extras-policy";
import type { ZdEstimatePackagingRow } from "@/lib/data/zd-estimate-packaging";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import type { ZdNameAutoExcludeMatch } from "@/lib/orders/zd-estimate-name-exclude";
import type { ZdEstimateIndividualTwExtra } from "@/lib/orders/zd-estimate-individual";
import { bomRowHidesHardExclude, bomRowHidesOnRequest } from "@/lib/orders/zd-estimate-bom";
import { formatWzSalesTitle } from "@/lib/orders/zd-estimate-wz-sales-ui";
import { formatSalesTrackHint } from "@/lib/orders/zd-estimate-sales-track";
import { isZdEstimatePendingReview } from "@/lib/orders/zd-estimate-confidence-ui";
import {
  formatZdPackUnitsPerLabelHint,
  isPackagingPackagesMode,
  lineAllowsZdDocumentUnitOverride,
  packagingDocumentMode,
  resolveOrderQtyForLine,
  type PackagingLookup,
  piecesArrivingForZdUnitsFromQty,
} from "@/lib/orders/zd-estimate-packaging";
import { zdEstimateDaysOfCover } from "@/lib/orders/zd-estimate-sort";
import {
  ZdEstimatePairPackStockCell,
  ZdEstimatePairPiecesCell,
  ZdEstimatePairSalesCell,
  ZdEstimatePiecesMetricCell,
} from "@/components/zakupy/ZdEstimatePairMetaBadge";
import { ZdEstimateDoZdCell } from "@/components/zakupy/ZdEstimateDoZdCell";
import { ZdEstimatePackagingCell } from "@/components/zakupy/ZdEstimatePackagingCell";
import { ZdEstimateNameMetaStack } from "@/components/zakupy/ZdEstimateNameMetaStack";
import { ZdEstimateQtyValue } from "@/components/zakupy/ZdEstimateQtyValue";
import { ZdEstimateReservationsCell } from "@/components/zakupy/ZdEstimateReservationsCell";
import { ZdEstimateRowActions } from "@/components/zakupy/ZdEstimateRowActions";
import { cn } from "@/lib/cn";
import { formatZdSalesProfileHint } from "@/lib/orders/zd-sales-profile";
import { checkboxBrandClass } from "@/lib/ui/ontime-theme";

/** Kolumny przepływu (Dost. → Sprzed. → Cel → Otwarte) — wspólne dla nagłówka i wierszy. */
/** „Starczy na” — dni do wyczerpania (dostępne / sprzedaż dziennie). */
function ZdEstimateCoverCell({
  line,
}: {
  line: Pick<ManualZdEstimateLine, "dostepne" | "sprzedazDziennie">;
}) {
  const days = zdEstimateDaysOfCover(line);
  if (days == null) {
    return (
      <span className="zd-est-cover zd-est-cover--none" title="Brak sprzedaży w oknie - nie kończy się">
        -
      </span>
    );
  }
  const tone = days <= 0 ? "out" : days <= 2 ? "critical" : days <= 14 ? "low" : "ok";
  const label = days <= 0 ? "brak" : days < 10 ? `${days.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} d` : `${Math.round(days)} d`;
  return (
    <span
      className={cn("zd-est-cover", `zd-est-cover--${tone}`)}
      title={
        days <= 0
          ? "Brak towaru dostępnego (stan − rezerwacje ≤ 0), a towar się sprzedaje"
          : `Przy obecnej sprzedaży (${formatQty(line.sprzedazDziennie)} szt/dzień) dostępny stan wystarczy na ok. ${label}`
      }
    >
      {label}
    </span>
  );
}

/** Znacznik profilu sprzedaży pod nazwą: jednorazowy skok / rzadka sprzedaż. */
function ZdEstimateSalesProfileBadge({
  profile,
  onRequest,
  onMarkOnRequest,
}: {
  profile: ManualZdEstimateLine["salesProfile"];
  onRequest: boolean;
  onMarkOnRequest?: () => void;
}) {
  if (!profile || (profile.kind !== "spike" && profile.kind !== "rare")) return null;
  const hint = formatZdSalesProfileHint(profile);
  if (profile.kind === "spike") {
    return (
      <span className="zd-est-profile-badge zd-est-profile-badge--spike" title={hint}>
        {profile.applied ? "skok · wygładzony" : "jednorazowy skok?"}
      </span>
    );
  }
  if (onRequest) return null;
  const label = profile.applied ? "rzadka · wygładzona" : "pod zamówienie?";
  if (!onMarkOnRequest) {
    return (
      <span className="zd-est-profile-badge zd-est-profile-badge--rare" title={hint}>
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      className="zd-est-profile-badge zd-est-profile-badge--rare"
      title={`${hint} Kliknij, żeby dodać do „Tylko na prośbę”.`}
      onClick={() => {
        if (
          window.confirm(
            "Dodać ten towar do „Tylko na prośbę”?\n\nZniknie z listy „Do ZD” - będzie zamawiany tylko pod aktywną prośbę handlowca. Cofniesz to w menu wiersza."
          )
        ) {
          onMarkOnRequest();
        }
      }}
    >
      {label}
    </button>
  );
}

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

export function zdEstimateFlowColumnClass(col: ZdEstimateOptionalColumn) {
  return col === "available" ||
    col === "sales" ||
    col === "target" ||
    col === "openZd"
    ? "zd-estimate-col--flow"
    : null;
}

export type ZdEstimateTableRowProps = {
  line: ManualZdEstimateLine;
  rowIndex: number;
  /** Wirtualizacja włączona — `data-index` + pomiar wysokości wiersza. */
  virtualized: boolean;
  measureElement?: (node: Element | null) => void;

  showPackagingColumn: boolean;
  optionalColumns: readonly ZdEstimateOptionalColumn[];
  columnSectionStarts: ReadonlySet<ZdEstimateOptionalColumn>;

  busy: boolean;
  /** Globalny mutate — stan komórki opakowania. */
  mutating: boolean;
  /** Mutacja dotyczy tego wiersza. */
  rowPending: boolean;
  packagingTrusted: boolean;
  exclusionsTrusted: boolean;
  onRequestTrusted: boolean;

  isSelected: boolean;
  excluded: boolean;
  dbExcluded: boolean;
  dbOnRequest: boolean;
  softOnRequest: boolean;
  liftedExtraOnly: boolean;
  sessionIncluded: boolean;
  /** tw „tylko na prośbę” (piece → pack z pary). */
  onRequestCanonicalId: number;
  nameHit: ZdNameAutoExcludeMatch | undefined;

  packRow: ZdEstimatePackagingRow | null;
  packLookup: PackagingLookup | null;
  individualExtra: ZdEstimateIndividualTwExtra | null;
  /** Prośby po dedupe z rezerwacjami (wejście Do ZD). */
  individualExtraPieces: number;
  stockNeedReliefPieces: number;
  extraOverlapPieces: number;
  minStockSzt: number | undefined;
  extrasPolicy: ZdEstimateExtrasPolicy;
  /** Surowe nadpisanie Do ZD z mapy — wiersz sam sprawdza, czy jest dozwolone. */
  overrideZdUnits: number | undefined;
  reviewAccepted: boolean;

  onToggleSelected: (twId: number, shiftKey: boolean) => void;
  onEditPackaging: (line: ManualZdEstimateLine) => void;
  onEditMinStock: (line: ManualZdEstimateLine) => void;
  onExclude: (line: ManualZdEstimateLine) => void;
  onRestore: (twId: number) => void;
  onMarkOnRequest: (line: ManualZdEstimateLine) => void;
  onClearOnRequest: (twId: number) => void;
  onSessionInclude: (twId: number, include: boolean) => void;
  /** `computedZdUnits` — wyliczone Do ZD; nadpisanie równe wyliczeniu jest usuwane. */
  onOverrideChange: (
    twId: number,
    next: number | null,
    computedZdUnits: number
  ) => void;
  onAcceptReview: (twId: number) => void;
  /** Ostatnie ZD na ten towar było u innego dostawcy (nazwa) — tylko podpowiedź. */
  otherSupplierHint?: string | null;
  /** Cena netto za sztukę z ostatniego ZD (null = brak ceny). */
  unitPriceNet?: number | null;
};

/**
 * Wiersz tabeli kreatora ZD. `memo` — wiersz renderuje się ponownie tylko, gdy
 * zmienią się jego własne dane (props są per-wiersz albo stabilne).
 */
export const ZdEstimateTableRow = memo(function ZdEstimateTableRow({
  line: l,
  rowIndex,
  virtualized,
  measureElement,
  showPackagingColumn,
  optionalColumns,
  columnSectionStarts,
  busy,
  mutating,
  rowPending,
  packagingTrusted,
  exclusionsTrusted,
  onRequestTrusted,
  isSelected,
  excluded,
  dbExcluded,
  dbOnRequest,
  softOnRequest,
  liftedExtraOnly,
  sessionIncluded,
  onRequestCanonicalId,
  nameHit,
  packRow,
  packLookup,
  individualExtra,
  individualExtraPieces,
  stockNeedReliefPieces,
  extraOverlapPieces,
  minStockSzt,
  extrasPolicy,
  overrideZdUnits,
  reviewAccepted,
  onToggleSelected,
  onEditPackaging,
  onEditMinStock,
  onExclude,
  onRestore,
  onMarkOnRequest,
  onClearOnRequest,
  onSessionInclude,
  onOverrideChange,
  onAcceptReview,
  otherSupplierHint,
  unitPriceNet,
}: ZdEstimateTableRowProps) {
  const hidePairOrBomHardActions = bomRowHidesHardExclude(l);
  const hideOnRequestAction = bomRowHidesOnRequest(l);
  const allowsDoZdOverride =
    !excluded && lineAllowsZdDocumentUnitOverride(l);
  const pairMeta = l.pair ?? null;
  const bomMeta = l.bom ?? null;
  const qty = resolveOrderQtyForLine(
    l,
    packLookup ??
      (packRow
        ? {
            unitsPerPackage: packRow.unitsPerPackage,
            packageLabel: packRow.packageLabel,
            documentUnitMode: packRow.documentUnitMode,
          }
        : null),
    individualExtraPieces,
    liftedExtraOnly,
    extrasPolicy,
    stockNeedReliefPieces,
    extraOverlapPieces,
    minStockSzt
  );
  const celPieces =
    Math.abs(l.salesTrackDelta) > 1e-9 ? l.celZapasuTracked : l.celZapasu;
  const minStockActive = minStockSzt != null && minStockSzt > celPieces;
  const salesTrackTitle =
    formatSalesTrackHint({
      applied: Math.abs(l.salesTrackDelta) > 1e-9,
      deltaPieces: l.salesTrackDelta,
      reasons: l.salesTrackReasons,
      confidence: l.salesTrackConfidence,
      qtyReview: l.salesTrackQtyReview,
      heldExtraQty: l.salesTrackHeldExtraQty,
      allowedExtraQty: l.salesTrackAllowedExtraQty,
    }) ?? undefined;
  const salesTrackSubline =
    l.salesTrackDelta > 1e-9 ? (
      <span className="zd-est-unit tabular-nums text-slate-500">
        +{formatQty(l.salesTrackDelta)} szt
      </span>
    ) : l.salesTrackDelta < -1e-9 ? (
      <span className="zd-est-unit tabular-nums text-amber-800/80">
        −{formatQty(Math.abs(l.salesTrackDelta))} szt
      </span>
    ) : null;
  const metricPackUnits =
    pairMeta && !pairMeta.partnerMissing
      ? pairMeta.unitsPerPack
      : qty.hasPackaging
        ? qty.unitsPerPackage
        : null;
  const packagingConflict =
    pairMeta?.role === "pack" &&
    packRow != null &&
    (packagingDocumentMode(packRow) === "pieces_multiple" ||
      (packRow.unitsPerPackage > 1 &&
        packRow.unitsPerPackage !== pairMeta.unitsPerPack));
  const overrideZd = allowsDoZdOverride ? overrideZdUnits : undefined;
  // „nie w Do ZD” tylko gdy exclude albo nadpisanie < wyliczenie
  // (Zeruj). Podbicie qty nadal pokrywa prośbę w Do ZD.
  const doZdSuppressed =
    excluded ||
    (overrideZd != null &&
      Number.isFinite(overrideZd) &&
      Math.trunc(overrideZd) < qty.zdUnits);
  const displayZdUnits =
    overrideZd != null && Number.isFinite(overrideZd)
      ? Math.trunc(overrideZd)
      : qty.zdUnits;
  const doZdIdle = excluded || displayZdUnits <= 0;
  const pendingReview = isZdEstimatePendingReview({
    qtyReview: l.salesTrackQtyReview,
    accepted: reviewAccepted,
    excluded,
  });

  return (
    <tr
      data-zd-estimate-tw-id={l.tw_Id}
      data-index={virtualized ? rowIndex : undefined}
      data-zebra={rowIndex % 2 === 1 ? "even" : "odd"}
      ref={virtualized ? measureElement : undefined}
      data-selected={isSelected ? "true" : undefined}
      data-min-stock={minStockActive ? "true" : undefined}
      className={cn(
        excluded && "bg-slate-50/80",
        isSelected && "zd-estimate-row-selected",
        minStockActive && "zd-estimate-row-min-stock"
      )}
    >
      <td className="zd-estimate-check-col">
        <input
          type="checkbox"
          className={checkboxBrandClass}
          checked={isSelected}
          disabled={busy}
          onClick={(e) => {
            if (!e.shiftKey) return;
            // Shift+zakres — bez natywnego toggle (stan ustawia zakres).
            e.preventDefault();
            onToggleSelected(l.tw_Id, true);
          }}
          onChange={(e) => {
            if (
              e.nativeEvent instanceof MouseEvent &&
              e.nativeEvent.shiftKey
            ) {
              return;
            }
            onToggleSelected(l.tw_Id, false);
          }}
          aria-label={`Zaznacz ${l.tw_Symbol}`}
        />
      </td>
      <td
        className={cn(
          "zd-estimate-symbol-col",
          excluded ? "text-slate-400" : "text-slate-900"
        )}
        title={l.tw_Symbol}
      >
        <span
          className={cn(
            "zd-est-symbol",
            excluded && "zd-est-symbol--excluded"
          )}
        >
          {l.tw_Symbol}
        </span>
      </td>
      <td
        className={cn(
          "zd-estimate-product-name-col",
          excluded ? "text-slate-400" : null
        )}
        title={l.tw_Nazwa}
      >
        <span className="zd-est-product-name">{l.tw_Nazwa}</span>
        <span className="zd-est-name-meta">
          <ZdEstimateNameMetaStack
            pairMeta={pairMeta}
            packagingConflict={packagingConflict}
            bomMeta={bomMeta}
            individualExtra={individualExtra}
            extrasPolicy={extrasPolicy}
            doZdSuppressed={doZdSuppressed}
            excluded={excluded}
            sessionIncluded={sessionIncluded}
            nameHit={nameHit}
            softOnRequest={softOnRequest}
            liftedExtraOnly={liftedExtraOnly}
            minStockSzt={minStockSzt ?? null}
            hideEmpty
          />
          {!excluded ? (
            <ZdEstimateSalesProfileBadge
              profile={l.salesProfile}
              onRequest={dbOnRequest || softOnRequest}
              onMarkOnRequest={
                exclusionsTrusted && onRequestTrusted && !hideOnRequestAction && !busy
                  ? () => onMarkOnRequest(l)
                  : undefined
              }
            />
          ) : null}
        </span>
        {otherSupplierHint ? (
          <span
            className="mt-0.5 block truncate text-[11px] font-medium text-amber-700"
            title={`Ostatnie ZD na ten towar: ${otherSupplierHint}. Jeśli zamawiasz go tam, przypisz go w Dostawcy → Zakresy (wspólne zakresy) albo wyklucz.`}
          >
            Ostatnie ZD: {otherSupplierHint}
          </span>
        ) : null}
      </td>
      {showPackagingColumn ? (
        <td className="zd-estimate-pack-col whitespace-nowrap">
          <ZdEstimatePackagingCell
            qty={qty}
            conflict={packagingConflict}
            disabled={busy || !packagingTrusted}
            pending={mutating}
            onEdit={() => onEditPackaging(l)}
          />
        </td>
      ) : null}
      <td
        className={cn(
          "zd-estimate-dozd-col text-center",
          pendingReview
            ? "zd-estimate-dozd-col--review"
            : doZdIdle
              ? "zd-estimate-dozd-col--idle"
              : null
        )}
      >
        <ZdEstimateDoZdCell
          qty={qty}
          excluded={excluded}
          individualExtraPieces={individualExtra?.extraPieces ?? 0}
          overrideZdUnits={
            allowsDoZdOverride ? overrideZdUnits ?? null : null
          }
          overrideDisabled={busy}
          onOverrideChange={
            allowsDoZdOverride
              ? (next) => onOverrideChange(l.tw_Id, next, qty.zdUnits)
              : undefined
          }
          confidence={l.salesTrackConfidence}
          qtyReview={l.salesTrackQtyReview}
          reasons={l.salesTrackReasons}
          accepted={reviewAccepted}
          detailHint={salesTrackTitle}
          onAccept={pendingReview ? () => onAcceptReview(l.tw_Id) : undefined}
        />
      </td>
      {optionalColumns.map((col) => {
        const sectionCls = columnSectionStarts.has(col)
          ? "zd-estimate-col--section"
          : null;
        const flowCls = zdEstimateFlowColumnClass(col);
        switch (col) {
          case "packaging":
            return null;
          case "cover":
            return (
              <td
                key={col}
                className={cn("zd-estimate-num-col zd-estimate-cover-col whitespace-nowrap", sectionCls)}
              >
                <ZdEstimateCoverCell line={l} />
              </td>
            );
          case "value": {
            const pieces =
              displayZdUnits > 0 && !excluded
                ? piecesArrivingForZdUnitsFromQty(displayZdUnits, qty)
                : 0;
            const value =
              unitPriceNet != null && unitPriceNet > 0 && pieces > 0
                ? pieces * unitPriceNet
                : null;
            return (
              <td
                key={col}
                className={cn("zd-estimate-num-col zd-estimate-value-col whitespace-nowrap", sectionCls)}
                title={
                  unitPriceNet != null && unitPriceNet > 0
                    ? `${formatQty(pieces)} szt × ${unitPriceNet.toFixed(2).replace(".", ",")} zł/szt (ostatnia cena z ZD)`
                    : "Brak ceny z ZD dla tego towaru"
                }
              >
                {value != null ? (
                  <span className="zd-est-value">{plnFormatter.format(value)}</span>
                ) : (
                  <span
                    className={cn(
                      "zd-est-value zd-est-value--none",
                      pieces > 0 && "zd-est-value--unpriced"
                    )}
                  >
                    {pieces > 0 ? "bez ceny" : "-"}
                  </span>
                )}
              </td>
            );
          }
          case "available":
            return (
              <td
                key={col}
                className={cn(
                  "zd-estimate-num-col whitespace-nowrap",
                  flowCls,
                  sectionCls
                )}
              >
                <span
                  className="zd-est-available"
                  title={`Stan ${formatQty(l.tw_Stan)} − rezerwacje ${formatQty(l.tw_StanRez)} = dostępne ${formatQty(l.dostepne)}`}
                >
                  {pairMeta?.role === "pack" ? (
                    <ZdEstimatePairPackStockCell
                      value={l.dostepne}
                      tier="b"
                      tone={l.dostepne <= 0 ? "warn" : "default"}
                    />
                  ) : (
                    <ZdEstimateQtyValue
                      value={l.dostepne}
                      tier="b"
                      unit="szt"
                      tone={l.dostepne <= 0 ? "warn" : "default"}
                    />
                  )}
                  {l.tw_StanRez > 0 ? (
                    <ZdEstimateReservationsCell
                      twId={l.tw_Id}
                      symbol={l.tw_Symbol}
                      name={l.tw_Nazwa}
                      reservedQty={l.tw_StanRez}
                    >
                      <span className="zd-est-available__rez">rez. {formatQty(l.tw_StanRez)}</span>
                    </ZdEstimateReservationsCell>
                  ) : null}
                </span>
              </td>
            );
          case "sales":
            return (
              <td
                key={col}
                className={cn(
                  "zd-estimate-metric-col zd-estimate-metric-col--sales",
                  flowCls,
                  sectionCls
                )}
              >
                {pairMeta && !pairMeta.partnerMissing ? (
                  <ZdEstimatePairSalesCell pair={pairMeta} />
                ) : (
                  <ZdEstimatePiecesMetricCell
                    pieces={l.sprzedazOkres}
                    unitsPerPack={qty.hasPackaging ? qty.unitsPerPackage : null}
                    tier="c"
                    zeroAsDash
                    title={
                      bomMeta?.role === "assembled_parent" &&
                      (bomMeta.relocatedSales ?? 0) > 0
                        ? [
                            `Sprzedaż zestawu ${formatQty(bomMeta.relocatedSales ?? 0)} szt przeniesiona do składników (wkład BOM) - tu 0, żeby nie dublować sumy.`,
                            formatWzSalesTitle({
                              sprzedazOkres: 0,
                              wzNiepowiazaneOkres: 0,
                              formatQty,
                            }),
                          ].join(" ")
                        : bomMeta?.role === "component" &&
                            (bomMeta.contributionSales ?? 0) > 0
                          ? [
                              formatWzSalesTitle({
                                sprzedazOkres: l.sprzedazOkres,
                                wzNiepowiazaneOkres: l.wzNiepowiazaneOkres,
                                formatQty,
                              }),
                              `W tym wkład BOM: ${formatQty(bomMeta.contributionSales ?? 0)} szt.`,
                            ].join(" ")
                          : [
                              formatWzSalesTitle({
                                sprzedazOkres: l.sprzedazOkres,
                                wzNiepowiazaneOkres: l.wzNiepowiazaneOkres,
                                formatQty,
                              }),
                              l.salesProfile ? formatZdSalesProfileHint(l.salesProfile) : null,
                            ]
                              .filter(Boolean)
                              .join(" ")
                    }
                  />
                )}
              </td>
            );
          case "target":
            return (
              <td
                key={col}
                className={cn(
                  "zd-estimate-metric-col zd-estimate-metric-col--target",
                  flowCls,
                  sectionCls
                )}
              >
                {pairMeta && !pairMeta.partnerMissing ? (
                  <ZdEstimatePairPiecesCell
                    pieces={celPieces}
                    unitsPerPack={pairMeta.unitsPerPack}
                    role={pairMeta.role}
                    subline={salesTrackSubline}
                  />
                ) : (
                  <ZdEstimatePiecesMetricCell
                    pieces={celPieces}
                    unitsPerPack={metricPackUnits}
                    tier="b"
                    title={salesTrackTitle}
                  />
                )}
              </td>
            );
          case "openZd":
            return (
              <td
                key={col}
                className={cn(
                  "zd-estimate-num-col whitespace-nowrap",
                  flowCls,
                  sectionCls
                )}
              >
                <ZdEstimateQtyValue
                  value={l.otwarteZd}
                  tier="c"
                  unit={
                    qty.hasPackaging &&
                    !isPackagingPackagesMode(qty.documentUnitMode)
                      ? "szt"
                      : "jdok"
                  }
                  zeroAsDash
                  title={
                    qty.hasPackaging &&
                    l.otwarteZd > 0 &&
                    isPackagingPackagesMode(qty.documentUnitMode)
                      ? `${formatQty(l.otwarteZd)} j.dok. = ${formatQty(l.otwarteZd * qty.unitsPerPackage)} szt (przeliczenie z kolumny Opak.)`
                      : qty.hasPackaging &&
                          l.otwarteZd > 0 &&
                          !isPackagingPackagesMode(qty.documentUnitMode)
                        ? `${formatQty(l.otwarteZd)} szt (otwarte ZD)`
                        : `${formatQty(l.otwarteZd)} j.dok. (otwarte ZD)`
                  }
                />
              </td>
            );
          case "zk":
            return (
              <Fragment key={col}>
                <td
                  className={cn(
                    "zd-estimate-num-col whitespace-nowrap",
                    sectionCls
                  )}
                >
                  <ZdEstimateQtyValue
                    value={l.otwarteZkBezRez}
                    tier="d"
                    zeroAsDash
                  />
                </td>
                <td className="zd-estimate-num-col whitespace-nowrap">
                  <ZdEstimateQtyValue
                    value={l.doZamowieniaApi}
                    tier="d"
                    zeroAsDash
                  />
                </td>
              </Fragment>
            );
          default:
            return null;
        }
      })}
      <td className="zd-estimate-spacer-col" aria-hidden />
      <td className="zd-estimate-actions-col text-center">
        <div className="inline-flex justify-center py-0.5">
          <ZdEstimateRowActions
            symbol={l.tw_Symbol}
            nameAutoExcluded={Boolean(nameHit)}
            dbExcluded={dbExcluded}
            onRequest={dbOnRequest}
            sessionIncluded={sessionIncluded}
            hideHardExclude={hidePairOrBomHardActions}
            hideOnRequest={hideOnRequestAction}
            packagingHint={
              qty.hasPackaging
                ? isPackagingPackagesMode(qty.documentUnitMode)
                  ? formatZdPackUnitsPerLabelHint(
                      qty.unitsPerPackage,
                      qty.packageLabel
                    )
                  : `dobij do ${qty.unitsPerPackage} szt`
                : null
            }
            minStockHint={
              minStockSzt !== undefined ? `min ${minStockSzt} szt` : null
            }
            disabled={busy}
            pending={rowPending}
            onPackaging={() => onEditPackaging(l)}
            onMinStock={() => onEditMinStock(l)}
            onExclude={() => {
              if (individualExtra) {
                const ok = window.confirm(
                  "Ta pozycja ma prośbę handlowca.\n\nPo wykluczeniu prośba trafi do sekcji „Usługi” i do uwag ZD (bez ilości towaru) - nie zniknie z panelu Dziś do utworzenia ZD.\n\nKontynuować?"
                );
                if (!ok) return;
              }
              onExclude(l);
            }}
            onRestore={() => onRestore(l.tw_Id)}
            onMarkOnRequest={
              exclusionsTrusted && onRequestTrusted
                ? () => onMarkOnRequest(l)
                : undefined
            }
            onClearOnRequest={
              onRequestTrusted
                ? () => onClearOnRequest(onRequestCanonicalId)
                : undefined
            }
            onSessionInclude={() => onSessionInclude(l.tw_Id, true)}
            onSessionIncludeClear={() => onSessionInclude(l.tw_Id, false)}
          />
        </div>
      </td>
    </tr>
  );
});
