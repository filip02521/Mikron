/**
 * Budowa payloadu / preview „Utwórz ZD” ze szacunku.
 * ilosc = zdUnits (jednostki dokumentu), nigdy piecesArriving.
 */

import { computeManualOrderQty } from "@/lib/orders/zd-estimate-manual";
import type { ManualZdEstimateLine } from "@/lib/orders/zd-estimate-manual";
import {
  computeZdPackOrderQty,
  resolveOrderQtyForLine,
  type PackagingLookup,
} from "@/lib/orders/zd-estimate-packaging";
import { clearSalesTrackQtyReviewMeta } from "@/lib/orders/zd-estimate-post-create";
import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
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
  ilosc: number;
  packagingHint: string | null;
  /** Rezerwa próśb (sztuki) wliczona w ilosc po opakowaniu. */
  individualExtraPieces?: number;
};

export type ZdCreatePreview = {
  lines: ZdCreatePreviewLine[];
  lineCount: number;
  zdUnitsSuma: number;
  softWarnOverLimit: boolean;
};

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
        "Dostawca nie ma powiązania z Subiektem (kh_Id). Uzupełnij w Administracji → Dostawcy.",
    };
  }
  return {
    ok: false,
    message:
      "Dostawca ma kilka dodatkowych kh_Id bez głównego — ustaw główny kh_Id w Administracji.",
  };
}

export function buildZdCreatePreviewFromOrderable(
  lines: readonly ManualZdEstimateLine[],
  packagingById: ReadonlyMap<number, PackagingLookup>,
  individualExtraByTwId?: ReadonlyMap<number, number> | null,
  /** Nadpisanie jednostek ZD (dokument) per tw_Id — przed Create. */
  qtyOverrideByTwId?: ReadonlyMap<number, number> | null,
  extraOnlyTwIds?: ReadonlySet<number> | null
): ZdCreatePreview {
  const previewLines: ZdCreatePreviewLine[] = [];
  let zdUnitsSuma = 0;
  for (const line of lines) {
    const extra = individualExtraByTwId?.get(line.tw_Id);
    const extraPieces =
      extra != null && Number.isFinite(extra) && extra > 0
        ? Math.ceil(extra)
        : 0;
    const extraOnly = extraOnlyTwIds?.has(line.tw_Id) === true;
    const qty = resolveOrderQtyForLine(
      line,
      packagingById.get(line.tw_Id),
      extraPieces,
      extraOnly
    );
    const override = qtyOverrideByTwId?.get(line.tw_Id);
    const zdUnits =
      override != null && Number.isFinite(override) && override >= 0
        ? Math.trunc(override)
        : qty.zdUnits;
    if (zdUnits <= 0) continue;
    zdUnitsSuma += zdUnits;
    previewLines.push({
      twId: line.tw_Id,
      symbol: line.tw_Symbol,
      nazwa: line.tw_Nazwa,
      plu: line.tw_PLU ?? null,
      ilosc: zdUnits,
      packagingHint: qty.hasPackaging
        ? `${qty.unitsPerPackage} szt / 1 ${qty.packageLabel}`
        : null,
      individualExtraPieces: extraPieces > 0 ? extraPieces : undefined,
    });
  }
  return {
    lines: previewLines,
    lineCount: previewLines.length,
    zdUnitsSuma,
    softWarnOverLimit: previewLines.length > ZD_CREATE_SOFT_WARN_LINES,
  };
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
  supplierName: string;
  scopeLabel: string | null;
  dateKey: string;
}): string {
  const parts = [
    "OnTime kreator",
    input.supplierName.trim() || null,
    input.scopeLabel?.trim() || null,
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
 */
export function ensureZdCreateLinesCoverIndividualExtras(input: {
  lines: readonly ZdCreateClientLineInput[];
  extraPiecesByTwId: ReadonlyMap<number, number> | null | undefined;
  unitsPerPackageByTwId?: ReadonlyMap<number, number> | null;
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
    const units = Math.max(
      1,
      Math.trunc(Number(input.unitsPerPackageByTwId?.get(line.twId)) || 1)
    );
    const minZd = computeZdPackOrderQty(extraPieces, units).zdUnits;
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
  if (state.explodeBomIncomplete) {
    return {
      ok: false,
      reason: ZD_ESTIMATE_UI.createGateExplodeBomIncomplete,
    };
  }
  if (state.estimating) {
    return { ok: false, reason: "Trwa przeliczanie szacunku." };
  }
  if (state.mutating || state.creating) {
    return { ok: false, reason: "Trwa inna operacja." };
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
      reason: `Konflikt opakowanie ↔ para (${state.packagingPairConflictCount}) — ujednolić przed Create.`,
    };
  }
  if (!(state.orderableCount > 0)) {
    return { ok: false, reason: "Brak pozycji do ZD." };
  }
  if (!state.supplierId?.trim()) {
    return {
      ok: false,
      reason:
        "Wybierz dostawcę (override) albo uzupełnij dopasowanie grupy/cechy do kartoteki.",
    };
  }
  const kh = state.khResolution;
  if (!kh || !kh.ok) {
    return {
      ok: false,
      reason: kh && !kh.ok ? kh.message : "Brak kh_Id dostawcy w Subiekcie.",
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
    const pack = packagingById?.get(line.tw_Id)?.unitsPerPackage;
    const otwarteZdPieces = zdDocumentUnitsToPieces(otwarteZd, pack);
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
