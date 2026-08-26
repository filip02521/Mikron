/**
 * Przeliczenie sztuk ↔ jednostki na ZD (opakowania).
 *
 * Tryb A (packages): 1 na ZD = N szt → Do ZD = ceil(need/N) paczek.
 * Tryb B (pieces_multiple): Do ZD w sztukach, dobij do wielokrotności N.
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
  isPackagingPackagesMode,
  normalizeOrderMultiple,
  normalizePackagingDocumentUnitMode,
  normalizeUnitsPerPackage,
  zdDocumentUnitsToPieces,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import {
  combineStockNeedWithExtra,
  type ZdEstimateExtrasPolicy,
} from "@/lib/orders/zd-estimate-extras-policy";

export {
  normalizeUnitsPerPackage,
  normalizeOrderMultiple,
  zdDocumentUnitsToPieces,
  normalizePackagingDocumentUnitMode,
  isPackagingPackagesMode,
};
export type { ZdPackagingDocumentUnitMode };

export type ZdPackOrderQty = {
  /** Niedobór w sztukach (sprzedaż / stan). */
  piecesNeeded: number;
  /** Sztuk w 1 jednostce ZD / wielokrotność dobicia (1 = bez opakowania). */
  unitsPerPackage: number;
  /** Co wpisać w ZD (paczki w A, sztuki w B). */
  zdUnits: number;
  /** Ile sztuk fizycznie przyjdzie. */
  piecesArriving: number;
  hasPackaging: boolean;
  /** Ceil opakowania / wielokrotność paczek zawyżył dostawę względem potrzeby. */
  roundedUp: boolean;
  packageLabel: string;
  documentUnitMode: ZdPackagingDocumentUnitMode;
  /** Wielokrotność liczby paczek (0 = off). */
  orderMultiple: number;
  /** Liczba paczek przed dobiciem do M (packages); null gdy M off / Mode B. */
  packsBeforeOrderMultiple: number | null;
};

export type PackagingLookup = {
  unitsPerPackage: number;
  packageLabel?: string;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  /** Wielokrotność liczby paczek (packages); null/1 = off. */
  orderMultiple?: number | null;
};

export function packagingDocumentMode(
  packaging?: Pick<PackagingLookup, "documentUnitMode"> | null
): ZdPackagingDocumentUnitMode {
  return normalizePackagingDocumentUnitMode(packaging?.documentUnitMode);
}

function emptyPackQty(
  pack: number,
  label: string,
  mode: ZdPackagingDocumentUnitMode,
  orderMultiple: number
): ZdPackOrderQty {
  return {
    piecesNeeded: 0,
    unitsPerPackage: pack,
    zdUnits: 0,
    piecesArriving: 0,
    hasPackaging: pack > 1,
    roundedUp: false,
    packageLabel: label,
    documentUnitMode: mode,
    orderMultiple,
    packsBeforeOrderMultiple: null,
  };
}

/**
 * piecesNeeded (szt) → jednostki ZD + ile sztuk przyjdzie.
 * `orderMultiple` — tylko tryb packages; dobija liczbę paczek gdy > 0.
 */
export function computeZdPackOrderQty(
  piecesNeeded: number,
  unitsPerPackage: number | null | undefined,
  packageLabel = "op.",
  documentUnitMode: ZdPackagingDocumentUnitMode | null | undefined = "packages",
  orderMultiple: number | null | undefined = null
): ZdPackOrderQty {
  const pieces = Math.max(0, Math.ceil(Number(piecesNeeded) || 0));
  const pack = normalizeUnitsPerPackage(unitsPerPackage);
  const label = packageLabel.trim() || "op.";
  const mode = normalizePackagingDocumentUnitMode(documentUnitMode);
  const mult = isPackagingPackagesMode(mode)
    ? normalizeOrderMultiple(orderMultiple)
    : 0;

  if (pieces <= 0) {
    return emptyPackQty(pack, label, mode, mult);
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
      documentUnitMode: "packages",
      orderMultiple: 0,
      packsBeforeOrderMultiple: null,
    };
  }

  if (!isPackagingPackagesMode(mode)) {
    const piecesArriving = Math.ceil(pieces / pack) * pack;
    return {
      piecesNeeded: pieces,
      unitsPerPackage: pack,
      zdUnits: piecesArriving,
      piecesArriving,
      hasPackaging: true,
      roundedUp: piecesArriving > pieces,
      packageLabel: label,
      documentUnitMode: "pieces_multiple",
      orderMultiple: 0,
      packsBeforeOrderMultiple: null,
    };
  }

  const packsBefore = Math.ceil(pieces / pack);
  let zdUnits = packsBefore;
  if (mult >= 2 && zdUnits > 0) {
    zdUnits = Math.ceil(zdUnits / mult) * mult;
  }
  const piecesArriving = zdUnits * pack;
  return {
    piecesNeeded: pieces,
    unitsPerPackage: pack,
    zdUnits,
    piecesArriving,
    hasPackaging: true,
    roundedUp: piecesArriving > pieces,
    packageLabel: label,
    documentUnitMode: "packages",
    orderMultiple: mult,
    packsBeforeOrderMultiple: mult >= 2 ? packsBefore : null,
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
 * `individualExtraPieces` — surowa rezerwa próśb (sztuki).
 * `extraOverlapPieces` — overlap z innych ZK; limitujemy do stock need
 *   (przy need=0 / extraOnly prośba nie spada do 0).
 * `extraOnly` — „tylko na prośbę”: baza stock / bakowany pair qty = 0, tylko extra.
 * `extrasPolicy` — `sum` (need+extra) albo `max(need, extra)`.
 * `stockNeedReliefPieces` — ulga need (własny source_zk prośby vs stanRez).
 * Para pack zawsze Mode A (packages).
 */
export function resolveOrderQtyForLine(
  line: ManualZdEstimateLine,
  packaging?: PackagingLookup | null,
  individualExtraPieces?: number,
  extraOnly = false,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  stockNeedReliefPieces = 0,
  extraOverlapPieces = 0
): ZdPackOrderQty {
  const rawExtra = Math.max(0, Math.ceil(Number(individualExtraPieces) || 0));
  const relief = Math.max(0, Math.ceil(Number(stockNeedReliefPieces) || 0));
  const uncappedOverlap = Math.max(
    0,
    Math.ceil(Number(extraOverlapPieces) || 0)
  );
  const label = packaging?.packageLabel?.trim() || "op.";
  const mode = packagingDocumentMode(packaging);
  const orderMult = packaging?.orderMultiple ?? null;

  const effectiveExtraForNeed = (stockNeed: number) => {
    const cappedOverlap = Math.min(uncappedOverlap, Math.max(0, stockNeed));
    return Math.max(0, rawExtra - cappedOverlap);
  };

  // Assembled parent: nigdy na ZD (także bez extras — explode idzie na składniki).
  if (isAssembledBomParent(line)) {
    return computeZdPackOrderQty(0, 1, label, "packages", null);
  }

  // kit_only composition: baza = 0, ale extras z explode próśb / multi-BOM mogą wejść.
  if (isBomPurchaseBlockedWithoutExplode(line)) {
    // Baza 0 → overlap nie obcina extra (jak extraOnly).
    const extra = effectiveExtraForNeed(0);
    if (line.pair?.role === "piece") {
      return computeZdPackOrderQty(0, 1, label, "packages", null);
    }
    if (line.pair?.role === "pack") {
      return computeZdPackOrderQty(
        extra,
        line.pair.unitsPerPack,
        label,
        "packages",
        orderMult
      );
    }
    const pack = normalizeUnitsPerPackage(packaging?.unitsPerPackage);
    return computeZdPackOrderQty(extra, pack, label, mode, orderMult);
  }

  // Para: qty już policzone w sztukach (cover/sales złączone) — Mode A.
  if (line.pair?.role === "piece") {
    return computeZdPackOrderQty(0, 1, label, "packages", null);
  }
  if (line.pair?.role === "pack") {
    const baseRaw = extraOnly
      ? 0
      : line.pair.partnerMissing
        ? 0
        : Math.max(0, Math.ceil(Number(line.doZamowieniaReczne) || 0));
    const base = Math.max(0, baseRaw - relief);
    return computeZdPackOrderQty(
      combineStockNeedWithExtra(
        base,
        effectiveExtraForNeed(base),
        extrasPolicy
      ),
      line.pair.unitsPerPack,
      label,
      "packages",
      orderMult
    );
  }

  const pack = normalizeUnitsPerPackage(packaging?.unitsPerPackage);
  if (extraOnly) {
    // need=0 → overlap nie obcina; Do ZD = prośba.
    return computeZdPackOrderQty(
      effectiveExtraForNeed(0),
      pack,
      label,
      mode,
      orderMult
    );
  }
  const otwarteZdRaw = Math.max(0, Number(line.otwarteZd) || 0);
  const otwarteZdPieces = zdDocumentUnitsToPieces(
    otwarteZdRaw,
    packaging?.unitsPerPackage,
    mode
  );
  const stockNeed = Math.max(
    0,
    computeManualOrderQty({
      celZapasu: line.celZapasuTracked ?? line.celZapasu,
      dostepne: line.dostepne,
      otwarteZd: otwarteZdPieces,
    }) - relief
  );
  const piecesNeeded = combineStockNeedWithExtra(
    stockNeed,
    effectiveExtraForNeed(stockNeed),
    extrasPolicy
  );
  return computeZdPackOrderQty(piecesNeeded, pack, label, mode, orderMult);
}

/** Etykiety presetów w dialogach opakowania (tylko prezentacja). */
export const ZD_PACKAGING_LABEL_PRESETS = [
  "op.",
  "karton",
  "paczka",
  "zbiorcze",
] as const;

/**
 * Skrót etykiety opakowania do gęstej tabeli (Opak. / Do ZD).
 * Pełna nazwa zostaje w `title` / dialogu — w komórce nigdy nie ucinamy w środku słowa.
 */
const ZD_PACK_COMPACT_LABEL_BY_KEY: Record<string, string> = {
  "op.": "op.",
  op: "op.",
  karton: "kart.",
  paczka: "pac.",
  zbiorcze: "zb.",
  zb: "zb.",
  "zb.": "zb.",
};

export function formatZdPackCompactLabel(packageLabel: string): string {
  const raw = packageLabel.trim() || "op.";
  const key = raw.toLowerCase();
  const mapped = ZD_PACK_COMPACT_LABEL_BY_KEY[key];
  if (mapped) return mapped;
  if (raw.length <= 5) return raw;
  // Własna etykieta: czytelny skrót z kropką (nie mid-word ellipsis).
  const stem = raw.replace(/\.+$/, "").trim();
  if (!stem) return "op.";
  if (stem.length <= 4) return `${stem}.`;
  return `${stem.slice(0, 4)}.`;
}

/** Proporcja w kolumnie Opak.: „szt/zb.” — zawsze mieści się w wąskiej kolumnie. */
export function formatZdPackTableRatioLabel(packageLabel: string): string {
  return `szt/${formatZdPackCompactLabel(packageLabel)}`;
}

/**
 * Hint „N szt / 1 etykieta” — pełna etykieta (menu, podgląd ZD, tooltips).
 * Do gęstej tabeli użyj {@link formatZdPackTableRatioLabel}.
 */
export function formatZdPackUnitsPerLabelHint(
  unitsPerPackage: number,
  packageLabel: string
): string {
  const n = Math.max(0, Math.trunc(Number(unitsPerPackage) || 0));
  const label = packageLabel.trim() || "op.";
  return `${n} szt / 1 ${label}`;
}

export const ZD_PACKAGING_UNITS_MIN = 2;
export const ZD_PACKAGING_UNITS_MAX = 100_000;

/** Walidacja zapisu opakowania — zgodna z DB CHECK (≥ 2). */
export function assertPackagingUnits(
  value: unknown
): { ok: true; units: number } | { ok: false; message: string } {
  const units = Math.trunc(Number(value));
  if (!Number.isFinite(units) || units < ZD_PACKAGING_UNITS_MIN) {
    return {
      ok: false,
      message: ZD_ESTIMATE_UI.packagingUnitsMinError,
    };
  }
  if (units > ZD_PACKAGING_UNITS_MAX) {
    return {
      ok: false,
      message: ZD_ESTIMATE_UI.packagingUnitsMaxError,
    };
  }
  return { ok: true, units };
}

/**
 * Walidacja order_multiple przy zapisie.
 * Puste / null / "" → off (null). ≥ 2 jak units.
 */
export function assertOrderMultiple(
  value: unknown
):
  | { ok: true; orderMultiple: number | null }
  | { ok: false; message: string } {
  if (value == null || value === "") {
    return { ok: true, orderMultiple: null };
  }
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 1) {
    return { ok: true, orderMultiple: null };
  }
  if (n === 1) {
    return { ok: true, orderMultiple: null };
  }
  if (n < ZD_PACKAGING_UNITS_MIN) {
    return {
      ok: false,
      message: ZD_ESTIMATE_UI.packagingOrderMultipleMinError,
    };
  }
  if (n > ZD_PACKAGING_UNITS_MAX) {
    return {
      ok: false,
      message: ZD_ESTIMATE_UI.packagingOrderMultipleMaxError,
    };
  }
  return { ok: true, orderMultiple: n };
}

/** Czy ręczne Do ZD jest wielokrotnością M (packages). */
export function isZdUnitsMultipleOfOrderMultiple(
  zdUnits: number,
  orderMultiple: number | null | undefined
): boolean {
  const m = normalizeOrderMultiple(orderMultiple);
  if (m < 2) return true;
  const u = Math.trunc(Number(zdUnits) || 0);
  if (u <= 0) return true;
  return u % m === 0;
}

/**
 * Krótka etykieta jednostek dokumentu.
 * A: „1 karton” / „3 op.” — B: null (dokument w sztukach).
 */
export function formatZdPackDocumentLabel(
  qty: Pick<
    ZdPackOrderQty,
    "zdUnits" | "hasPackaging" | "packageLabel" | "documentUnitMode"
  >
): string | null {
  if (!qty.hasPackaging || !(qty.zdUnits > 0)) return null;
  if (!isPackagingPackagesMode(qty.documentUnitMode)) return null;
  const label = qty.packageLabel.trim() || "op.";
  return `${qty.zdUnits} ${label}`;
}

export function formatZdPackHint(qty: ZdPackOrderQty): string {
  if (!qty.hasPackaging) {
    return qty.zdUnits > 0 ? `${qty.zdUnits} szt` : "—";
  }
  const over =
    qty.roundedUp && qty.piecesNeeded > 0
      ? ` · potrzeba ${qty.piecesNeeded} szt`
      : "";
  if (!isPackagingPackagesMode(qty.documentUnitMode)) {
    return `${qty.zdUnits} szt (paczka ${qty.unitsPerPackage})${over}`;
  }
  const doc = formatZdPackDocumentLabel(qty);
  if (!doc) return "—";
  const packWord = qty.packageLabel.trim() || "op.";
  const multHint =
    qty.orderMultiple >= 2 ? ` · co ${qty.orderMultiple} ${packWord}` : "";
  return `${doc} × ${qty.unitsPerPackage} = ${qty.piecesArriving} szt${multHint}${over}`;
}

/**
 * Linia „Na ZD” w dialogu Opak. — A: paczki × N; B: sztuki (bez fałszywego × N).
 */
export function formatZdPackOrderPreviewLine(qty: ZdPackOrderQty): string {
  if (!(qty.zdUnits > 0)) return "—";
  if (!qty.hasPackaging) {
    return `${formatQty(qty.zdUnits)} szt`;
  }
  if (!isPackagingPackagesMode(qty.documentUnitMode)) {
    return `${formatQty(qty.zdUnits)} szt (wielokrotność ${qty.unitsPerPackage})`;
  }
  const packStep =
    qty.orderMultiple >= 2 &&
    qty.packsBeforeOrderMultiple != null &&
    qty.packsBeforeOrderMultiple !== qty.zdUnits
      ? ` (${qty.packsBeforeOrderMultiple}→${qty.zdUnits} op.)`
      : qty.orderMultiple >= 2
        ? ` · co ${qty.orderMultiple}`
        : "";
  return `${qty.zdUnits} × ${qty.unitsPerPackage} = ${formatQty(qty.piecesArriving)} szt${packStep}`;
}

/** Dane dobicia — do kompaktowego UI w wąskiej kolumnie Do ZD. */
export type ZdPackRoundupInfo = {
  extra: number;
  need: number;
  arrive: number;
  /** Dobicie liczby paczek (packages + orderMultiple). */
  packsBefore: number | null;
  packsAfter: number | null;
};

export function getZdPackRoundupInfo(
  qty: Pick<
    ZdPackOrderQty,
    | "roundedUp"
    | "piecesNeeded"
    | "piecesArriving"
    | "hasPackaging"
    | "zdUnits"
    | "packsBeforeOrderMultiple"
    | "orderMultiple"
    | "documentUnitMode"
    | "packageLabel"
  >
): ZdPackRoundupInfo | null {
  if (!qty.hasPackaging || !qty.roundedUp) return null;
  const need = Math.max(0, Math.round(Number(qty.piecesNeeded) || 0));
  const arrive = Math.max(0, Math.round(Number(qty.piecesArriving) || 0));
  if (!(arrive > need) || need <= 0) return null;
  const packsBefore =
    isPackagingPackagesMode(qty.documentUnitMode) &&
    qty.orderMultiple >= 2 &&
    qty.packsBeforeOrderMultiple != null
      ? qty.packsBeforeOrderMultiple
      : null;
  const packsAfter =
    packsBefore != null && qty.zdUnits > packsBefore ? qty.zdUnits : null;
  return {
    extra: arrive - need,
    need,
    arrive,
    packsBefore,
    packsAfter,
  };
}

/** Linia dobicia: paczki „3→10 op.” albo sztuki „dobicie +1 szt (9→10)”. */
export function formatZdPackRoundupLine(
  qty: Pick<
    ZdPackOrderQty,
    | "roundedUp"
    | "piecesNeeded"
    | "piecesArriving"
    | "hasPackaging"
    | "zdUnits"
    | "packsBeforeOrderMultiple"
    | "orderMultiple"
    | "documentUnitMode"
    | "packageLabel"
  >
): string | null {
  const info = getZdPackRoundupInfo(qty);
  if (!info) return null;
  if (info.packsBefore != null && info.packsAfter != null) {
    const label = qty.packageLabel?.trim() || "op.";
    return `${info.packsBefore}→${info.packsAfter} ${label}`;
  }
  return `dobicie +${info.extra} szt (${info.need}→${info.arrive})`;
}

/**
 * Sztuki przy ręcznym nadpisaniu jednostek ZD.
 * Mode B: zdUnits już w sztukach → identity.
 */
export function piecesArrivingForZdUnits(
  zdUnits: number,
  unitsPerPackage: number | null | undefined,
  documentUnitMode: ZdPackagingDocumentUnitMode | null | undefined = "packages"
): number {
  const units = Math.max(0, Math.trunc(Number(zdUnits) || 0));
  if (!isPackagingPackagesMode(documentUnitMode)) {
    return units;
  }
  const pack = normalizeUnitsPerPackage(unitsPerPackage);
  if (pack <= 1) return units;
  return units * pack;
}

export function packagingByTwId<T extends { subiektTwId: number }>(
  rows: readonly T[]
): Map<number, T> {
  const map = new Map<number, T>();
  for (const row of rows) map.set(row.subiektTwId, row);
  return map;
}

export type ZdEstimatePackagingRefreshEntry = {
  unitsPerPackage: number;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  orderMultiple?: number | null;
};

/** Mapa na live remat / Policz (N + tryb + wielokrotność paczek). Mode B → M null. */
export function packagingRowsToRefreshLookup(
  rows: readonly {
    subiektTwId: number;
    unitsPerPackage: number;
    documentUnitMode?: ZdPackagingDocumentUnitMode | null;
    orderMultiple?: number | null;
  }[]
): Map<number, ZdEstimatePackagingRefreshEntry> {
  const map = new Map<number, ZdEstimatePackagingRefreshEntry>();
  for (const row of rows) {
    const mode = normalizePackagingDocumentUnitMode(row.documentUnitMode);
    map.set(row.subiektTwId, {
      unitsPerPackage: row.unitsPerPackage,
      documentUnitMode: mode,
      orderMultiple: isPackagingPackagesMode(mode)
        ? row.orderMultiple ?? null
        : null,
    });
  }
  return map;
}

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
  extraOnly = false,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  stockNeedReliefPieces = 0,
  extraOverlapPieces = 0
): number {
  const computed = resolveOrderQtyForLine(
    line,
    packaging,
    individualExtraPieces ?? undefined,
    extraOnly,
    extrasPolicy,
    stockNeedReliefPieces,
    extraOverlapPieces
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
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
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
      extraOnlyTwIds?.has(twId) === true,
      extrasPolicy,
      individualExtraPiecesForTw(twId, stockNeedReliefByTwId),
      individualExtraPiecesForTw(twId, extraOverlapByTwId)
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
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
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
    const relief = individualExtraPiecesForTw(
      line.tw_Id,
      stockNeedReliefByTwId
    );
    const overlap = individualExtraPiecesForTw(
      line.tw_Id,
      extraOverlapByTwId
    );
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(
      line,
      pack,
      extra,
      extraOnly,
      extrasPolicy,
      relief,
      overlap
    );
    const zdUnits = effectiveZdDocumentUnits(
      line,
      pack,
      extra,
      qtyOverrideByTwId?.get(line.tw_Id),
      extraOnly,
      extrasPolicy,
      relief,
      overlap
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
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  /**
   * Surowe extra (przed overlap). Gdy adjusted qty = 0, a tu > 0 i tw jest
   * extraOnly — zostaw linię widoczną (Do ZD 0), żeby prośba nie „znikała”.
   */
  rawIndividualExtraByTwId?: ReadonlyMap<number, number> | null,
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
): ManualZdEstimateLine[] {
  const excluded =
    excludedTwIds instanceof Set
      ? excludedTwIds
      : new Set(excludedTwIds ?? []);
  return lines.filter((line) => {
    if (excluded.has(line.tw_Id)) return false;
    const units = effectiveZdDocumentUnits(
      line,
      packagingById.get(line.tw_Id),
      individualExtraPiecesForTw(line.tw_Id, individualExtraByTwId),
      qtyOverrideByTwId?.get(line.tw_Id),
      extraOnlyTwIds?.has(line.tw_Id) === true,
      extrasPolicy,
      individualExtraPiecesForTw(line.tw_Id, stockNeedReliefByTwId),
      individualExtraPiecesForTw(line.tw_Id, extraOverlapByTwId)
    );
    if (units > 0) return true;
    if (extraOnlyTwIds?.has(line.tw_Id) !== true) return false;
    return individualExtraPiecesForTw(line.tw_Id, rawIndividualExtraByTwId) > 0;
  });
}

/** TSV z qty uwzględniającym opakowania, otwarte ZD i nadpisania sesji. */
export function orderableLinesToTsv(
  lines: ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy: ZdEstimateExtrasPolicy = "sum",
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
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
    const relief = individualExtraPiecesForTw(
      line.tw_Id,
      stockNeedReliefByTwId
    );
    const overlap = individualExtraPiecesForTw(
      line.tw_Id,
      extraOverlapByTwId
    );
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(
      line,
      pack,
      extra,
      extraOnly,
      extrasPolicy,
      relief,
      overlap
    );
    const zdUnits = effectiveZdDocumentUnits(
      line,
      pack,
      extra,
      qtyOverrideByTwId?.get(line.tw_Id),
      extraOnly,
      extrasPolicy,
      relief,
      overlap
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
