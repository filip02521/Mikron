/**
 * Przeliczenie sztuk ↔ jednostki na ZD (opakowania).
 *
 * Przykład Falcon DO.6312.03: 1 na ZD = 10 szt.
 * Potrzeba 8 szt → wpisz 1 na ZD → przyjdzie 10 szt.
 *
 * Gdy produkt ma opakowanie, otwarte ZD z API traktujemy jako jednostki ZD
 * (paczki), nie sztuki — bo tak wpisuje się dokumenty.
 */

import {
  computeManualOrderQty,
  formatQty,
  type ManualZdEstimateLine,
} from "@/lib/orders/zd-estimate-manual";
import {
  bomBlocksZdOrder,
  isAssembledBomParent,
  isBomPurchaseBlockedWithoutExplode,
} from "@/lib/orders/zd-estimate-bom";
import {
  normalizeUnitsPerPackage,
  zdDocumentUnitsToPieces,
} from "@/lib/orders/zd-estimate-units";

export { normalizeUnitsPerPackage, zdDocumentUnitsToPieces };

export type ZdPackOrderQty = {
  /** Niedobór w sztukach (sprzedaż / stan). */
  piecesNeeded: number;
  /** Sztuk w 1 jednostce ZD (1 = bez opakowania). */
  unitsPerPackage: number;
  /** Co wpisać w ZD. */
  zdUnits: number;
  /** Ile sztuk fizycznie przyjdzie (zdUnits × opakowanie). */
  piecesArriving: number;
  hasPackaging: boolean;
  /** Ceil opakowania zawyżył dostawę względem potrzeby. */
  roundedUp: boolean;
  packageLabel: string;
};

/**
 * piecesNeeded (szt) → jednostki ZD + ile sztuk przyjdzie.
 */
export function computeZdPackOrderQty(
  piecesNeeded: number,
  unitsPerPackage: number | null | undefined,
  packageLabel = "op."
): ZdPackOrderQty {
  const pieces = Math.max(0, Math.ceil(Number(piecesNeeded) || 0));
  const pack = normalizeUnitsPerPackage(unitsPerPackage);
  const label = packageLabel.trim() || "op.";

  if (pieces <= 0) {
    return {
      piecesNeeded: 0,
      unitsPerPackage: pack,
      zdUnits: 0,
      piecesArriving: 0,
      hasPackaging: pack > 1,
      roundedUp: false,
      packageLabel: label,
    };
  }

  if (pack <= 1) {
    return {
      piecesNeeded: pieces,
      unitsPerPackage: 1,
      zdUnits: pieces,
      piecesArriving: pieces,
      hasPackaging: false,
      roundedUp: false,
      packageLabel: label,
    };
  }

  const zdUnits = Math.ceil(pieces / pack);
  const piecesArriving = zdUnits * pack;
  return {
    piecesNeeded: pieces,
    unitsPerPackage: pack,
    zdUnits,
    piecesArriving,
    hasPackaging: true,
    roundedUp: piecesArriving > pieces,
    packageLabel: label,
  };
}

/** Rezerwa handlowca (sztuki) z mapy tw → extra. */
export function individualExtraPiecesForTw(
  twId: number,
  extras?: ReadonlyMap<number, number> | null
): number {
  if (!extras) return 0;
  const n = Number(extras.get(Math.trunc(twId)));
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
}

/**
 * Pełne qty zamówienia dla pozycji: uwzględnia opakowanie przy otwartych ZD
 * i przelicza wynik na jednostki do wpisania w dokumencie.
 * `individualExtraPieces` — rezerwa próśb (sztuki) dodana przed ceil opakowania.
 * `extraOnly` — „tylko na prośbę”: baza stock / bakowany pair qty = 0, tylko extra.
 */
export function resolveOrderQtyForLine(
  line: ManualZdEstimateLine,
  packaging?: {
    unitsPerPackage: number;
    packageLabel?: string;
  } | null,
  individualExtraPieces?: number,
  extraOnly = false
): ZdPackOrderQty {
  const extra = Math.max(0, Math.ceil(Number(individualExtraPieces) || 0));
  const label = packaging?.packageLabel?.trim() || "op.";

  // Assembled parent: nigdy na ZD (także bez extras — explode idzie na składniki).
  if (isAssembledBomParent(line)) {
    return computeZdPackOrderQty(0, 1, label);
  }

  // kit_only composition: baza = 0, ale extras z explode próśb / multi-BOM mogą wejść.
  if (isBomPurchaseBlockedWithoutExplode(line)) {
    if (line.pair?.role === "piece") {
      return computeZdPackOrderQty(0, 1, label);
    }
    if (line.pair?.role === "pack") {
      return computeZdPackOrderQty(extra, line.pair.unitsPerPack, label);
    }
    const pack = normalizeUnitsPerPackage(packaging?.unitsPerPackage);
    return computeZdPackOrderQty(extra, pack, label);
  }

  // Para: qty już policzone w sztukach (cover/sales złączone) — nie przeliczaj z karty pack.
  if (line.pair?.role === "piece") {
    return computeZdPackOrderQty(0, 1, label);
  }
  if (line.pair?.role === "pack") {
    const base = extraOnly
      ? 0
      : line.pair.partnerMissing
        ? 0
        : Math.max(0, Math.ceil(Number(line.doZamowieniaReczne) || 0));
    return computeZdPackOrderQty(base + extra, line.pair.unitsPerPack, label);
  }

  const pack = normalizeUnitsPerPackage(packaging?.unitsPerPackage);
  if (extraOnly) {
    return computeZdPackOrderQty(extra, pack, label);
  }
  const otwarteZdRaw = Math.max(0, Number(line.otwarteZd) || 0);
  // Przy opakowaniu Subiekt trzyma qty ZD w paczkach → na sztuki × pack.
  const otwarteZdPieces = zdDocumentUnitsToPieces(
    otwarteZdRaw,
    packaging?.unitsPerPackage
  );
  const piecesNeeded =
    computeManualOrderQty({
      celZapasu: line.celZapasuTracked ?? line.celZapasu,
      dostepne: line.dostepne,
      otwarteZd: otwarteZdPieces,
    }) + extra;
  return computeZdPackOrderQty(piecesNeeded, pack, label);
}

export function formatZdPackHint(qty: ZdPackOrderQty): string {
  if (!qty.hasPackaging) {
    return qty.zdUnits > 0 ? `${qty.zdUnits} szt` : "—";
  }
  if (qty.zdUnits <= 0) return "—";
  const over =
    qty.roundedUp && qty.piecesNeeded > 0
      ? ` · potrzeba ${qty.piecesNeeded} szt`
      : "";
  return `${qty.zdUnits} ${qty.packageLabel} × ${qty.unitsPerPackage} = ${qty.piecesArriving} szt${over}`;
}

export function packagingByTwId<T extends { subiektTwId: number }>(
  rows: readonly T[]
): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) map.set(row.subiektTwId, row);
  return map;
}

export type PackagingLookup = {
  unitsPerPackage: number;
  packageLabel?: string;
};

/**
 * Jednostki ZD (dokument) z opcjonalnym nadpisaniem sesji.
 * Brak override → wyliczone z `resolveOrderQtyForLine`.
 * Piece pary / BOM parent — override ignorowany (nigdy na ZD).
 */
export function lineAllowsZdDocumentUnitOverride(
  line: Pick<ManualZdEstimateLine, "pair" | "bom">
): boolean {
  if (bomBlocksZdOrder(line)) return false;
  if (line.pair?.role === "piece") return false;
  return true;
}

export function effectiveZdDocumentUnits(
  line: ManualZdEstimateLine,
  packaging: PackagingLookup | null | undefined,
  individualExtraPieces?: number | null,
  overrideZdUnits?: number | null,
  extraOnly = false
): number {
  const computed = resolveOrderQtyForLine(
    line,
    packaging,
    individualExtraPieces ?? undefined,
    extraOnly
  ).zdUnits;
  if (!lineAllowsZdDocumentUnitOverride(line)) {
    return computed;
  }
  if (
    overrideZdUnits != null &&
    Number.isFinite(overrideZdUnits) &&
    overrideZdUnits >= 0
  ) {
    return Math.trunc(overrideZdUnits);
  }
  return computed;
}

/**
 * Usuwa nadpisania równe wyliczeniu lub bez linii.
 * Zwraca ten sam obiekt `overrides`, gdy nic nie spadło (stabilna referencja).
 */
export function pruneZdDocumentUnitOverrides(
  overrides: Readonly<Record<number, number>>,
  lines: readonly ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null
): Record<number, number> {
  let changed = false;
  const next: Record<number, number> = {};
  for (const [key, override] of Object.entries(overrides)) {
    const twId = Number(key);
    const line = lines.find((l) => l.tw_Id === twId);
    if (!line) {
      changed = true;
      continue;
    }
    if (!lineAllowsZdDocumentUnitOverride(line)) {
      changed = true;
      continue;
    }
    const computed = resolveOrderQtyForLine(
      line,
      packagingById.get(twId) ?? null,
      individualExtraPiecesForTw(twId, individualExtraByTwId),
      extraOnlyTwIds?.has(twId) === true
    ).zdUnits;
    if (Math.trunc(override) === computed) {
      changed = true;
      continue;
    }
    next[twId] = Math.trunc(override);
  }
  return changed ? next : (overrides as Record<number, number>);
}

export function summarizePackOrderQty(
  lines: ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  excludedTwIds?: ReadonlySet<number> | readonly number[] | null,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null
): {
  doZamowieniaCount: number;
  piecesNeededSuma: number;
  zdUnitsSuma: number;
  piecesArrivingSuma: number;
} {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  let doZamowieniaCount = 0;
  let piecesNeededSuma = 0;
  let zdUnitsSuma = 0;
  let piecesArrivingSuma = 0;
  for (const line of lines) {
    if (excluded.has(line.tw_Id)) continue;
    const pack = packagingById.get(line.tw_Id);
    const extra = individualExtraPiecesForTw(
      line.tw_Id,
      individualExtraByTwId
    );
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(line, pack, extra, extraOnly);
    const zdUnits = effectiveZdDocumentUnits(
      line,
      pack,
      extra,
      qtyOverrideByTwId?.get(line.tw_Id),
      extraOnly
    );
    if (zdUnits <= 0) continue;
    doZamowieniaCount += 1;
    piecesNeededSuma += qty.piecesNeeded;
    zdUnitsSuma += zdUnits;
    piecesArrivingSuma +=
      qty.hasPackaging && qty.zdUnits > 0
        ? Math.round((qty.piecesArriving / qty.zdUnits) * zdUnits)
        : zdUnits;
  }
  return {
    doZamowieniaCount,
    piecesNeededSuma,
    zdUnitsSuma,
    piecesArrivingSuma,
  };
}

export function filterOrderableLinesWithPackaging(
  lines: ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  excludedTwIds?: ReadonlySet<number> | readonly number[] | null,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null
): ManualZdEstimateLine[] {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  return lines.filter((line) => {
    if (excluded.has(line.tw_Id)) return false;
    return (
      effectiveZdDocumentUnits(
        line,
        packagingById.get(line.tw_Id),
        individualExtraPiecesForTw(line.tw_Id, individualExtraByTwId),
        qtyOverrideByTwId?.get(line.tw_Id),
        extraOnlyTwIds?.has(line.tw_Id) === true
      ) > 0
    );
  });
}

/** TSV z qty uwzględniającym opakowania, otwarte ZD i nadpisania sesji. */
export function orderableLinesToTsv(
  lines: ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null
): string {
  const header = [
    "symbol",
    "nazwa",
    "do_zd",
    "szt_opakowania",
    "etykieta_op",
    "szt_przyjdzie",
    "szt_potrzeba",
    "stan",
    "rezerwacje",
    "dostepne",
    "sprzedaz_okres",
    "cel_zapasu",
    "cel_sledzony",
    "delta_sledzenia",
    "otwarte_zd",
    "otwarte_zk_bez_rez",
    "tw_Id",
  ].join("\t");
  const rows = lines.map((line) => {
    const pack = packagingById.get(line.tw_Id);
    const extra = individualExtraPiecesForTw(
      line.tw_Id,
      individualExtraByTwId
    );
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(line, pack, extra, extraOnly);
    const zdUnits = effectiveZdDocumentUnits(
      line,
      pack,
      extra,
      qtyOverrideByTwId?.get(line.tw_Id),
      extraOnly
    );
    const piecesArriving =
      qty.hasPackaging && qty.zdUnits > 0
        ? Math.round((qty.piecesArriving / qty.zdUnits) * zdUnits)
        : zdUnits;
    return [
      line.tw_Symbol,
      line.tw_Nazwa,
      zdUnits,
      qty.hasPackaging ? qty.unitsPerPackage : "",
      qty.hasPackaging ? qty.packageLabel : "",
      piecesArriving,
      qty.piecesNeeded,
      formatQty(line.tw_Stan),
      formatQty(line.tw_StanRez),
      formatQty(line.dostepne),
      formatQty(line.sprzedazOkres),
      formatQty(line.celZapasu),
      formatQty(line.celZapasuTracked),
      Math.abs(line.salesTrackDelta) > 1e-9
        ? formatQty(line.salesTrackDelta)
        : "",
      formatQty(line.otwarteZd),
      formatQty(line.otwarteZkBezRez),
      line.tw_Id,
    ].join("\t");
  });
  return [header, ...rows].join("\n");
}
