/**
 * Budowa payloadu / preview „Utwórz ZD” ze szacunku.
 * ilosc = zdUnits (jednostki dokumentu), nigdy piecesArriving.
 */

import { computeManualOrderQty } from "@/lib/orders/zd-estimate-manual";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  computeZdPackOrderQty,
  formatZdPackUnitsPerLabelHint,
  getZdPackRoundupInfo,
  isPackagingPackagesMode,
  lineAllowsZdDocumentUnitOverride,
  packagingDocumentMode,
  piecesArrivingForZdUnits,
  resolveOrderQtyForLine,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import { clearSalesTrackQtyReviewMeta } from "@/lib/orders/zd-estimate-post-create";
import {
  zdDocumentUnitsToPieces,
  type ZdPackagingDocumentUnitMode,
} from "@/lib/orders/zd-estimate-units";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import type { SubiektCreateZdInput } from "@/lib/subiekt/types";

export const ZD_CREATE_MAX_LINES = 500;
export const ZD_CREATE_SOFT_WARN_LINES = 200;
export const ZD_CREATE_MAX_QTY = 100_000;
export const ZD_CREATE_MAX_UWAGI_LEN = 500;

export type ZdCreateKhResolution =
  | {
      ok: true;
      khId: number;
      usedAlias: boolean;
      supplierName: string;
    }
  | { ok: false; message: string };

export type ZdCreatePreviewLine = {
  twId: number;
  symbol: string;
  nazwa: string;
  plu?: string | null;
  /** Jednostki dokumentu ZD (paczki w trybie A, sztuki w B). */
  ilosc: number;
  packagingHint: string | null;
  /** Rezerwa próśb (sztuki) wliczona w ilosc po opakowaniu. */
  individualExtraPieces?: number;
  extraOnly?: boolean;
  piecesArriving?: number | null;
  unitsPerPackage?: number | null;
  documentUnitMode?: ZdPackagingDocumentUnitMode | null;
  roundupNeed?: number | null;
  roundupArrive?: number | null;
  celZapasuTracked?: number;
  salesTrackDelta?: number;
  bomOrPairLabel?: string | null;
};

export type ZdCreatePreview = {
  lines: ZdCreatePreviewLine[];
  lineCount: number;
  zdUnitsSuma: number;
  piecesArrivingSuma: number;
  extraRequestLineCount: number;
  softWarnOverLimit: boolean;
};

export function previewBomOrPairLabel(
  line: Pick<ManualZdEstimateLine, "bom" | "pair">
): string | null {
  const bomRole = line.bom?.role;
  if (bomRole === "assembled_parent") {
    return "zestaw (składamy)";
  }
  if (bomRole === "purchased_kit") {
    return line.bom?.purchaseTarget === "kit_only"
      ? "komplet (tylko K)"
      : "komplet (kupujemy)";
  }
  if (bomRole === "component") {
    return line.bom?.purchaseBlocked ? "składnik (poza zakupem)" : "składnik BOM";
  }
  if (line.pair?.role === "pack") {
    const n = Math.trunc(Number(line.pair.unitsPerPack) || 0);
    return n > 0 ? `para ${n} szt/op.` : "para (op.)";
  }
  if (line.pair?.role === "piece") return "para (luz)";
  return null;
}

export type ZdCreateClientLineInput = {
  twId: number;
  ilosc: number;
  /** Opcjonalnie — do serwerowego matchu próśb (symbol / PLU). */
  symbol?: string | null;
  plu?: string | null;
};

/** Wszystkie kh dostawcy (primary + aliasy) — filtr historii snapshotów. */
export function listZdEstimateSupplierKhIds(input: {
  primaryKhId: number | null | undefined;
  additionalKhIds?: readonly number[] | null;
}): number[] {
  const ids = new Set<number>();
  const primary = Math.trunc(Number(input.primaryKhId));
  if (Number.isFinite(primary) && primary > 0) ids.add(primary);
  for (const raw of input.additionalKhIds ?? []) {
    const n = Math.trunc(Number(raw));
    if (Number.isFinite(n) && n > 0) ids.add(n);
  }
  return [...ids];
}

/** Resolve kh: primary → dokładnie 1 alias → błąd. */
export function resolveZdCreateKhId(input: {
  supplierName: string;
  primaryKhId: number | null | undefined;
  additionalKhIds?: readonly number[] | null;
}): ZdCreateKhResolution {
  const name = input.supplierName.trim() || "Dostawca";
  const primary = Math.trunc(Number(input.primaryKhId));
  if (Number.isFinite(primary) && primary > 0) {
    return {
      ok: true,
      khId: primary,
      usedAlias: false,
      supplierName: name,
    };
  }
  const aliases = [
    ...new Set(
      (input.additionalKhIds ?? [])
        .map((id) => Math.trunc(Number(id)))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  if (aliases.length === 1) {
    return {
      ok: true,
      khId: aliases[0]!,
      usedAlias: true,
      supplierName: name,
    };
  }
  if (aliases.length === 0) {
    return {
      ok: false,
      message:
        "Dostawca nie ma powiązania z Subiektem (kontrahent). Uzupełnij w Administracji → Dostawcy.",
    };
  }
  return {
    ok: false,
    message:
      "Dostawca ma kilka dodatkowych identyfikatorów kontrahenta bez głównego — ustaw główny w Administracji.",
  };
}

export function buildZdCreatePreviewFromOrderable(
  lines: readonly ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  /** Nadpisanie jednostek ZD (dokument) per tw_Id — przed Create. */
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null,
  extrasPolicy?: import("@/lib/orders/zd-estimate-extras-policy").ZdEstimateExtrasPolicy,
  stockNeedReliefByTwId?: ReadonlyMap<number, number> | null,
  extraOverlapByTwId?: ReadonlyMap<number, number> | null
): ZdCreatePreview {
  const previewLines: ZdCreatePreviewLine[] = [];
  let zdUnitsSuma = 0;
  let piecesArrivingSuma = 0;
  let extraRequestLineCount = 0;
  for (const line of lines) {
    const extra = individualExtraByTwId?.get(line.tw_Id);
    const extraPieces =
      extra != null && Number.isFinite(extra) && extra > 0
        ? Math.ceil(extra)
        : 0;
    const reliefRaw = stockNeedReliefByTwId?.get(line.tw_Id);
    const relief =
      reliefRaw != null && Number.isFinite(reliefRaw) && reliefRaw > 0
        ? Math.ceil(reliefRaw)
        : 0;
    const overlapRaw = extraOverlapByTwId?.get(line.tw_Id);
    const overlap =
      overlapRaw != null && Number.isFinite(overlapRaw) && overlapRaw > 0
        ? Math.ceil(overlapRaw)
        : 0;
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(
      line,
      packagingById.get(line.tw_Id),
      extraPieces,
      extraOnly,
      extrasPolicy,
      relief,
      overlap
    );
    const override = qtyOverrideByTwId?.get(line.tw_Id);
    const usedOverride =
      lineAllowsZdDocumentUnitOverride(line) &&
      override != null &&
      Number.isFinite(override) &&
      override >= 0;
    const finalZd = usedOverride ? Math.trunc(override!) : qty.zdUnits;
    if (finalZd <= 0) continue;
    const piecesArriving = usedOverride
      ? piecesArrivingForZdUnits(
          finalZd,
          qty.unitsPerPackage,
          qty.documentUnitMode
        )
      : qty.piecesArriving;
    const roundup = usedOverride ? null : getZdPackRoundupInfo(qty);
    zdUnitsSuma += finalZd;
    piecesArrivingSuma += piecesArriving;
    if (extraPieces > 0) extraRequestLineCount += 1;
    previewLines.push({
      twId: line.tw_Id,
      symbol: line.tw_Symbol,
      nazwa: line.tw_Nazwa,
      plu: line.tw_PLU ?? null,
      ilosc: finalZd,
      packagingHint: qty.hasPackaging
        ? isPackagingPackagesMode(qty.documentUnitMode)
          ? formatZdPackUnitsPerLabelHint(
              qty.unitsPerPackage,
              qty.packageLabel
            )
          : `dobij do ${qty.unitsPerPackage} szt`
        : null,
      individualExtraPieces: extraPieces > 0 ? extraPieces : undefined,
      extraOnly: extraOnly || undefined,
      piecesArriving,
      unitsPerPackage: qty.hasPackaging ? qty.unitsPerPackage : null,
      documentUnitMode: qty.hasPackaging ? qty.documentUnitMode : null,
      roundupNeed: roundup?.need ?? null,
      roundupArrive: roundup?.arrive ?? null,
      celZapasuTracked: line.celZapasuTracked,
      salesTrackDelta: line.salesTrackDelta,
      bomOrPairLabel: previewBomOrPairLabel(line),
    });
  }
  return {
    lines: previewLines,
    lineCount: previewLines.length,
    zdUnitsSuma,
    piecesArrivingSuma,
    extraRequestLineCount,
    softWarnOverLimit: previewLines.length > ZD_CREATE_SOFT_WARN_LINES,
  };
}

export function applyCreatedQtyToPreviewLines(
  lines: readonly ZdCreatePreviewLine[],
  createdLines: readonly { twId: number; ilosc: number }[] | null | undefined
): ZdCreatePreviewLine[] {
  if (!createdLines?.length) return lines.map((l) => ({ ...l }));
  const byTw = new Map<number, number>();
  for (const row of createdLines) {
    const tw = Math.trunc(Number(row.twId) || 0);
    const qty = Math.max(0, Math.round(Number(row.ilosc) || 0));
    if (tw > 0) byTw.set(tw, qty);
  }
  return lines.map((line) => {
    const next = byTw.get(line.twId);
    if (next == null || next === line.ilosc) return { ...line };
    const piecesArriving =
      line.unitsPerPackage != null && line.unitsPerPackage > 1
        ? piecesArrivingForZdUnits(
            next,
            line.unitsPerPackage,
            line.documentUnitMode ?? "packages"
          )
        : next;
    return { ...line, ilosc: next, piecesArriving };
  });
}

export function buildZdCreateApiBody(input: {
  kontrahentId: number;
  uwagi?: string | null;
  lines: readonly ZdCreateClientLineInput[];
}): SubiektCreateZdInput {
  return {
    kontrahentId: Math.trunc(input.kontrahentId),
    uwagi: normalizeZdCreateUwagi(input.uwagi),
    pozycje: input.lines.map((l) => ({
      towarId: Math.trunc(l.twId),
      ilosc: Number(l.ilosc),
    })),
  };
}

export function normalizeZdCreateUwagi(
  value: string | null | undefined
): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, ZD_CREATE_MAX_UWAGI_LEN);
}

export function defaultZdCreateUwagi(input: {
  /** Czy zakres to grupa towarowa, czy cecha Subiekta. */
  scopeMode: "grupa" | "cecha";
  /** Nazwa grupy lub cechy (bez prefiksu „Grupa”/„Cecha”). */
  scopeLabel: string | null;
  dateKey: string;
}): string {
  const label = input.scopeLabel?.trim() || null;
  const scopePart = label
    ? input.scopeMode === "cecha"
      ? `Cecha ${label}`
      : `Grupa ${label}`
    : null;
  const parts = [
    "OnTime kreator",
    scopePart,
    input.dateKey.trim() || null,
  ].filter(Boolean);
  return parts.join(" · ").slice(0, ZD_CREATE_MAX_UWAGI_LEN);
}

export type ZdCreateValidateLinesResult =
  | { ok: true; lines: ZdCreateClientLineInput[] }
  | { ok: false; message: string };

/** Walidacja linii przed POST (serwer + UI). */
export function validateZdCreateClientLines(
  lines: readonly ZdCreateClientLineInput[] | null | undefined
): ZdCreateValidateLinesResult {
  if (!lines?.length) {
    return { ok: false, message: "Brak pozycji do ZD." };
  }
  if (lines.length > ZD_CREATE_MAX_LINES) {
    return {
      ok: false,
      message: `Za dużo pozycji (${lines.length}). Maks. ${ZD_CREATE_MAX_LINES} — zawęź zakres lub wyklucz towary.`,
    };
  }
  const seen = new Set<number>();
  const normalized: ZdCreateClientLineInput[] = [];
  for (const raw of lines) {
    const twId = Math.trunc(Number(raw.twId));
    const ilosc = Number(raw.ilosc);
    if (!(twId > 0)) {
      return { ok: false, message: "Pozycja bez poprawnego towarId." };
    }
    if (seen.has(twId)) {
      return {
        ok: false,
        message: `Zduplikowany towar tw_Id=${twId} w liście do ZD.`,
      };
    }
    seen.add(twId);
    if (!Number.isFinite(ilosc) || ilosc <= 0) {
      return {
        ok: false,
        message: `Ilość musi być > 0 (tw_Id=${twId}).`,
      };
    }
    if (ilosc > ZD_CREATE_MAX_QTY) {
      return {
        ok: false,
        message: `Ilość zbyt duża dla tw_Id=${twId} (max ${ZD_CREATE_MAX_QTY}).`,
      };
    }
    const symbolRaw = String(raw.symbol ?? "").trim();
    const pluRaw = String(raw.plu ?? "").trim();
    normalized.push({
      twId,
      ilosc,
      ...(symbolRaw ? { symbol: symbolRaw } : {}),
      ...(pluRaw ? { plu: pluRaw } : {}),
    });
  }
  return { ok: true, lines: normalized };
}

/**
 * Gwarantuje, że ilosc na ZD pokrywa co najmniej rezerwę próśb (ceil opakowania).
 * Nie zaniża qty względem klienta — tylko podbija, gdy extras > wysłane.
 * Mode B: minZd = ceil(extra/N)*N (sztuki), nie liczba paczek.
 */
export function minZdUnitsForExtraPieces(
  extraPieces: number,
  unitsPerPackage: number | null | undefined,
  documentUnitMode: ZdPackagingDocumentUnitMode | null | undefined
): number {
  const pieces =
    extraPieces != null && Number.isFinite(extraPieces) && extraPieces > 0
      ? Math.ceil(extraPieces)
      : 0;
  if (!(pieces > 0)) return 0;
  const units = Math.max(1, Math.trunc(Number(unitsPerPackage) || 1));
  const mode = documentUnitMode ?? "packages";
  return computeZdPackOrderQty(pieces, units, "op.", mode).zdUnits;
}

/**
 * Kandydaci overlap ZK: fetch tylko gdy linia create nie pokrywa minZd(raw extra).
 * Brak linii → toFetch. Nie zawęża scoped extras poza candidates.
 */
export function partitionProsbaOverlapFetchTwIds(input: {
  candidates: readonly number[];
  rawExtraByTwId: ReadonlyMap<number, number>;
  linesByTwId: ReadonlyMap<number, { ilosc: number }>;
  unitsPerPackageByTwId?: ReadonlyMap<number, number> | null;
  packagingModeByTwId?: ReadonlyMap<
    number,
    ZdPackagingDocumentUnitMode
  > | null;
}): { toFetch: number[]; skipCover: number[] } {
  const toFetch: number[] = [];
  const skipCover: number[] = [];
  for (const rawTw of input.candidates) {
    const tw = Math.trunc(Number(rawTw)) || 0;
    if (!(tw > 0)) continue;
    const rawExtra = input.rawExtraByTwId.get(tw);
    if (!(rawExtra != null && Number.isFinite(rawExtra) && rawExtra > 0)) {
      continue;
    }
    const line = input.linesByTwId.get(tw);
    const minZd = minZdUnitsForExtraPieces(
      rawExtra,
      input.unitsPerPackageByTwId?.get(tw),
      input.packagingModeByTwId?.get(tw)
    );
    if (!line || !(line.ilosc >= minZd)) {
      toFetch.push(tw);
    } else {
      skipCover.push(tw);
    }
  }
  return { toFetch, skipCover };
}

export function ensureZdCreateLinesCoverIndividualExtras(input: {
  lines: readonly ZdCreateClientLineInput[];
  extraPiecesByTwId: ReadonlyMap<number, number> | null | undefined;
  unitsPerPackageByTwId?: ReadonlyMap<number, number> | null;
  packagingModeByTwId?: ReadonlyMap<
    number,
    ZdPackagingDocumentUnitMode
  > | null;
}): {
  lines: ZdCreateClientLineInput[];
  bumped: Array<{
    twId: number;
    from: number;
    to: number;
    extraPieces: number;
  }>;
} {
  const extras = input.extraPiecesByTwId;
  if (!extras?.size) {
    return { lines: input.lines.map((l) => ({ ...l })), bumped: [] };
  }
  const bumped: Array<{
    twId: number;
    from: number;
    to: number;
    extraPieces: number;
  }> = [];
  const lines = input.lines.map((line) => {
    const extraRaw = extras.get(line.twId);
    const extraPieces =
      extraRaw != null && Number.isFinite(extraRaw) && extraRaw > 0
        ? Math.ceil(extraRaw)
        : 0;
    if (!(extraPieces > 0)) return { ...line };
    const minZd = minZdUnitsForExtraPieces(
      extraPieces,
      input.unitsPerPackageByTwId?.get(line.twId),
      input.packagingModeByTwId?.get(line.twId)
    );
    if (!(minZd > line.ilosc)) return { ...line };
    bumped.push({
      twId: line.twId,
      from: line.ilosc,
      to: minZd,
      extraPieces,
    });
    return { ...line, ilosc: minZd };
  });
  return { lines, bumped };
}

export type CanCreateZdState = {
  configured: boolean;
  settingsTrusted: boolean;
  orderableCount: number;
  supplierId: string | null | undefined;
  khResolution: ZdCreateKhResolution | null;
  estimating: boolean;
  mutating: boolean;
  creating: boolean;
  createDoneDokId: number | null;
  /**
   * Timeout create: dokument mógł powstać w Subiekcie, ale brak dokId.
   * Blokuje Create jak po sukcesie (do unlock / Policz / potwierdzenia linkiem).
   */
  createUnconfirmedAttempt?: boolean;
  /** Świadome odblokowanie po create — pozwala otworzyć Create ponownie. */
  createUnlockedAfterDone?: boolean;
  /** Konflikty opakowanie ↔ para (pack) — blokują Create do ujednolicenia. */
  packagingPairConflictCount?: number;
  /** Brakujące węzły BOM explode — blokują Create (popyt niepełny). */
  explodeBomIncomplete?: boolean;
  /** Moc boosta zmieniona po Policz — wymagany re-Policz. */
  boostNeedsRecount?: boolean;
  /** Kwalifikacja snapshotów do history cut zmieniona — wymagany re-Policz. */
  historyNeedsRecount?: boolean;
  /** Fetch historii snapshotów rzucił przy Policz — cięcia historyczne mogły nie wejść.
   * Pusta historia (brak wierszy) to nie błąd.
   */
  historyFetchFailed?: boolean;
  /** Fetch próśb przy Policz / reload nieudany. */
  pendingIndividualsError?: string | null;
  /** Wczytano tylko prefix próśb (limit 500) — Create na serwerze i tak odrzuci. */
  pendingIndividualsTruncated?: boolean;
  /** Trwa fetch próśb — Create nie może iść na stale/pustej liście. */
  pendingIndividualsLoading?: boolean;
  /** Fetch overlap prośba↔ZK w toku — Create na fail-open mógłby zawyżyć qty. */
  prosbaOverlapPending?: boolean;
};

export function canCreateZdFromEstimateState(
  state: CanCreateZdState
): { ok: true } | { ok: false; reason: string } {
  if (!state.configured) {
    return {
      ok: false,
      reason: "Brak połączenia z hostem ORDERS (live :5080 / test :5082).",
    };
  }
  if (!state.settingsTrusted) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateNeedsSettings,
    };
  }
  if (state.pendingIndividualsError?.trim()) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGatePendingIndividualsError,
    };
  }
  if (state.pendingIndividualsTruncated) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGatePendingIndividualsTruncated,
    };
  }
  if (state.pendingIndividualsLoading) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGatePendingIndividualsLoading,
    };
  }
  if (state.prosbaOverlapPending) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateProsbaOverlapPending,
    };
  }
  if (state.historyFetchFailed) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateHistoryFetchFailed,
    };
  }
  if (state.boostNeedsRecount) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateBoostNeedsRecount,
    };
  }
  if (state.historyNeedsRecount) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateHistoryNeedsRecount,
    };
  }
  if (state.explodeBomIncomplete) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateExplodeBomIncomplete,
    };
  }
  if (state.estimating) {
    return { ok: false, reason: ZD_ESTIMATE_UI.createGateEstimating };
  }
  if (state.mutating || state.creating) {
    return { ok: false, reason: ZD_ESTIMATE_UI.createGateMutating };
  }
  const createLocked =
    !state.createUnlockedAfterDone &&
    ((state.createDoneDokId != null && state.createDoneDokId > 0) ||
      state.createUnconfirmedAttempt === true);
  if (createLocked) {
    return {
      ok: false,
      reason: state.createUnconfirmedAttempt
        ? "Ostatnie tworzenie ZD zakończyło się timeoutem — sprawdź Subiekt / powiąż dokument, przelicz listę albo odblokuj świadomie."
        : "ZD już utworzone z tej listy — powiąż inne ZD ręcznie, przelicz listę albo odblokuj świadomie.",
    };
  }
  if (
    state.packagingPairConflictCount != null &&
    state.packagingPairConflictCount > 0
  ) {
    return {
      ok: false,
      reason: `Konflikt opakowanie ↔ para (${state.packagingPairConflictCount}) — ujednolić przed utworzeniem ZD.`,
    };
  }
  if (!(state.orderableCount > 0)) {
    return { ok: false, reason: "Brak pozycji do ZD." };
  }
  if (!state.supplierId?.trim()) {
    return {
      ok: false,
      reason:
        "Wybierz dostawcę (pole zaawansowane) albo uzupełnij dopasowanie grupy/cechy do kartoteki.",
    };
  }
  const kh = state.khResolution;
  if (!kh || !kh.ok) {
    return {
      ok: false,
      reason: kh && !kh.ok ? kh.message : "Brak identyfikatora kontrahenta (kh) dostawcy w Subiekcie.",
    };
  }
  return { ok: true };
}

/** Optimistic bump otwarteZd (jednostki dok.) + przeliczenie doZamowieniaReczne. */
export function applyCreatedZdUnitsToOtwarteZd(
  lines: ManualZdEstimateLine[],
  created: ReadonlyMap<number, number>,
  packagingById?: ReadonlyMap<number, PackagingLookup> | null
): ManualZdEstimateLine[] {
  if (created.size === 0) return lines;
  return lines.map((line) => {
    const add = created.get(line.tw_Id);
    if (add == null || !(add > 0)) return line;
    const otwarteZd = Math.max(0, Number(line.otwarteZd) || 0) + add;
    const packLookup = packagingById?.get(line.tw_Id);
    const pack = packLookup?.unitsPerPackage;
    const otwarteZdPieces = zdDocumentUnitsToPieces(
      otwarteZd,
      pack,
      packagingDocumentMode(packLookup)
    );
    const doZamowieniaReczne = computeManualOrderQty({
      celZapasu: line.celZapasuTracked ?? line.celZapasu,
      dostepne: line.dostepne,
      otwarteZd: otwarteZdPieces,
    });
    // Cover się zmienił — stary review qty z tracka jest nieaktualny.
    const cleared = clearSalesTrackQtyReviewMeta(line);
    return { ...cleared, otwarteZd, doZamowieniaReczne };
  });
}
