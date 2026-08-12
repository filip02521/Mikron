/**
 * Budowa linii snapshotu ZD ze szacunku — wspólne dla „Powiąż ZD” i create.
 * qty w snapshotcie = sztuki (ob_Ilosc × opakowanie/para).
 */

import { zdDocumentUnitsToPieces } from "@/lib/orders/zd-estimate-units";
import type { SubiektDocument } from "@/lib/subiekt/types";

export type ZdEstimateSnapshotLineMeta = {
  twId: number;
  celAtLink?: number | null;
  deltaAtLink?: number | null;
};

export type ZdEstimateSnapshotLineBuilt = {
  twId: number;
  twSymbol: string | null;
  twNazwa: string | null;
  qty: number;
  celAtLink: number | null;
  deltaAtLink: number | null;
  ratioAtLink: number | null;
};

export type BuildZdEstimateSnapshotLinesResult =
  | { ok: true; lines: ZdEstimateSnapshotLineBuilt[] }
  | { ok: false; message: string };

export type ImplicitPieceSnapshotLine = {
  twId: number;
  symbol: string;
  nazwa: string;
};

export type SnapshotPackResolution =
  | { ok: true; ratio: number; source: "pair" | "packaging" | "confirmed" | "legacy" }
  | { ok: false };

/**
 * Jedno źródło prawdy: skąd bierzemy ratio jednostka ZD → sztuki dla tw_Id.
 * Używane przez builder snapshotu i preflight UI.
 */
export function resolveSnapshotPackForTwId(
  twId: number,
  options: {
    packagingByTwId: ReadonlyMap<number, number>;
    pairRatioByTwId: ReadonlyMap<number, number>;
    confirmedEstimateTwIds?: ReadonlySet<number> | null;
    requirePackaging?: boolean;
  }
): SnapshotPackResolution {
  const pairRatio = options.pairRatioByTwId.get(twId);
  const hasPairRatio =
    pairRatio != null && Number.isFinite(pairRatio) && pairRatio > 0;
  if (hasPairRatio) {
    return { ok: true, ratio: pairRatio!, source: "pair" };
  }

  const packFromTable = options.packagingByTwId.get(twId);
  const hasPackaging =
    packFromTable != null &&
    Number.isFinite(packFromTable) &&
    packFromTable > 0;
  if (hasPackaging) {
    return { ok: true, ratio: packFromTable!, source: "packaging" };
  }

  const requirePackaging = options.requirePackaging === true;
  const confirmed =
    options.confirmedEstimateTwIds?.has(twId) === true;
  if (requirePackaging) {
    if (confirmed) {
      return { ok: true, ratio: 1, source: "confirmed" };
    }
    return { ok: false };
  }

  return { ok: true, ratio: 1, source: "legacy" };
}

/** Indeks ratio z par kompletów (pack → unitsPerPack, piece → 1). */
export function buildPairRatioByTwId(
  pairs: readonly {
    packTwId: number;
    pieceTwId: number;
    unitsPerPack: number;
  }[]
): Map<number, number> {
  const map = new Map<number, number>();
  for (const p of pairs) {
    const pack = Math.trunc(Number(p.packTwId));
    const piece = Math.trunc(Number(p.pieceTwId));
    const ratio = Math.trunc(Number(p.unitsPerPack));
    if (pack > 0 && Number.isFinite(ratio) && ratio > 0) {
      map.set(pack, ratio);
    }
    if (piece > 0 && !map.has(piece)) {
      map.set(piece, 1);
    }
  }
  return map;
}

/** Czy tw_Id ma jawne źródło ratio (para lub opakowanie) — bez confirmed bypass. */
export function twIdHasSnapshotPackagingSource(
  twId: number,
  packagingByTwId: ReadonlyMap<number, number>,
  pairRatioByTwId: ReadonlyMap<number, number>
): boolean {
  const pairRatio = pairRatioByTwId.get(twId);
  if (pairRatio != null && Number.isFinite(pairRatio) && pairRatio > 0) {
    return true;
  }
  const pack = packagingByTwId.get(twId);
  return pack != null && Number.isFinite(pack) && pack > 0;
}

/**
 * Pozycje do ZD bez opakowania / pary — historia zapisze 1:1 (sztuki).
 * Używane w preflight UI przed Create / Powiąż ZD.
 */
export function collectImplicitPieceSnapshotLines(
  lines: readonly { twId: number; symbol: string; nazwa: string }[],
  packagingByTwId: ReadonlyMap<number, number>,
  pairRatioByTwId: ReadonlyMap<number, number>
): ImplicitPieceSnapshotLine[] {
  const out: ImplicitPieceSnapshotLine[] = [];
  for (const line of lines) {
    const twId = Math.trunc(Number(line.twId));
    if (!(twId > 0)) continue;
    if (twIdHasSnapshotPackagingSource(twId, packagingByTwId, pairRatioByTwId)) {
      continue;
    }
    out.push({
      twId,
      symbol: line.symbol.trim() || `tw_Id ${twId}`,
      nazwa: line.nazwa.trim() || "—",
    });
  }
  return out;
}

export function buildZdEstimateSnapshotLinesFromDoc(
  doc: SubiektDocument,
  options: {
    packagingByTwId?: ReadonlyMap<number, number> | null;
    pairRatioByTwId?: ReadonlyMap<number, number> | null;
    lineMeta?: readonly ZdEstimateSnapshotLineMeta[] | null;
    /** tw_Id z bieżącego kreatora / Create — brak opakowania = potwierdzone 1:1. */
    confirmedEstimateTwIds?: ReadonlySet<number> | null;
    /**
     * Gdy true — brak opakowania (i brak ratio pary) dla linii z qty > 0
     * → błąd (bez cichego ×1).
     */
    requirePackaging?: boolean;
  } = {}
): ZdEstimateSnapshotLineBuilt[] {
  const built = buildZdEstimateSnapshotLinesFromDocChecked(doc, options);
  if (!built.ok) {
    throw new Error(built.message);
  }
  return built.lines;
}

/** Wariant z jawnym wynikiem — do actions (głośny fail bez throw w warstwie mapowania). */
export function buildZdEstimateSnapshotLinesFromDocChecked(
  doc: SubiektDocument,
  options: {
    packagingByTwId?: ReadonlyMap<number, number> | null;
    pairRatioByTwId?: ReadonlyMap<number, number> | null;
    lineMeta?: readonly ZdEstimateSnapshotLineMeta[] | null;
    confirmedEstimateTwIds?: ReadonlySet<number> | null;
    requirePackaging?: boolean;
  } = {}
): BuildZdEstimateSnapshotLinesResult {
  const packagingByTwId = options.packagingByTwId ?? new Map<number, number>();
  const pairRatioByTwId = options.pairRatioByTwId ?? new Map<number, number>();
  const confirmedEstimateTwIds = options.confirmedEstimateTwIds ?? null;
  const requirePackaging = options.requirePackaging === true;
  const metaByTw = new Map<
    number,
    { celAtLink?: number | null; deltaAtLink?: number | null }
  >();
  for (const m of options.lineMeta ?? []) {
    const twId = Math.trunc(Number(m.twId));
    if (twId > 0) metaByTw.set(twId, m);
  }

  const missingPack: Array<{ twId: number; symbol: string | null }> = [];
  const lines: ZdEstimateSnapshotLineBuilt[] = [];

  for (const l of doc.dok_Pozycja ?? []) {
    const twId = Math.trunc(Number(l.ob_TowId ?? 0));
    if (!(twId > 0)) continue;
    const docQty = Number(l.ob_Ilosc) || 0;
    if (!(docQty > 0)) continue;

    const lineSymbol = l.tw_Symbol?.trim() || null;

    const meta = metaByTw.get(twId);

    const resolved = resolveSnapshotPackForTwId(twId, {
      packagingByTwId,
      pairRatioByTwId,
      confirmedEstimateTwIds,
      requirePackaging,
    });

    if (!resolved.ok) {
      missingPack.push({ twId, symbol: lineSymbol });
      continue;
    }

    const pack = resolved.ratio;
    const ratioAtLink =
      resolved.source === "pair" || pack === 1 ? pack : null;

    lines.push({
      twId,
      twSymbol: l.tw_Symbol?.trim() || null,
      twNazwa: l.tw_Nazwa?.trim() || null,
      qty: zdDocumentUnitsToPieces(docQty, pack),
      celAtLink: meta?.celAtLink ?? null,
      deltaAtLink: meta?.deltaAtLink ?? null,
      ratioAtLink,
    });
  }

  if (missingPack.length > 0) {
    const sample = missingPack
      .slice(0, 8)
      .map(({ twId, symbol }) => (symbol ? `${symbol} (${twId})` : String(twId)))
      .join(", ");
    const more =
      missingPack.length > 8 ? ` (+${missingPack.length - 8})` : "";
    return {
      ok: false,
      message: `Brak opakowania (lub ratio pary) dla: ${sample}${more}. Uzupełnij opakowania w panelu „Opakowania” albo dodaj parę kompletów — bez cichego ×1 dla pozycji spoza szacunku.`,
    };
  }

  return { ok: true, lines };
}

/** Z lineMeta szacunku — do walidacji confirmedTwIds (subset check). */
export function confirmedEstimateTwIdsFromLineMeta(
  lineMeta: readonly { twId: number }[] | null | undefined
): Set<number> {
  const out = new Set<number>();
  for (const m of lineMeta ?? []) {
    const twId = Math.trunc(Number(m.twId));
    if (twId > 0) out.add(twId);
  }
  return out;
}

/**
 * Potwierdzone tw_Id do snapshotu przy Powiąż ZD.
 * orderableTwIds (z preview „Do ZD”) musi być podzbiorem lineMeta — inaczej odrzucone.
 */
export function resolveConfirmedEstimateTwIdsForLink(input: {
  /** tw_Id z orderable preview — NIE cała lista szacunku (wykluczone off). */
  orderableTwIds?: readonly number[] | null;
  lineMeta?: readonly ZdEstimateSnapshotLineMeta[] | null;
}): Set<number> {
  const metaIds = confirmedEstimateTwIdsFromLineMeta(input.lineMeta);
  if (!metaIds.size) return new Set<number>();

  const out = new Set<number>();
  for (const raw of input.orderableTwIds ?? []) {
    const twId = Math.trunc(Number(raw));
    if (twId > 0 && metaIds.has(twId)) out.add(twId);
  }
  return out;
}

/** Pozycje dokumentu spoza zbioru orderable / create — pomoc przy diagnozie błędu. */
export function twIdsOnDocOutsideOrderable(
  doc: SubiektDocument,
  orderableTwIds: ReadonlySet<number>
): number[] {
  const out: number[] = [];
  for (const l of doc.dok_Pozycja ?? []) {
    const twId = Math.trunc(Number(l.ob_TowId ?? 0));
    const qty = Number(l.ob_Ilosc) || 0;
    if (!(twId > 0) || !(qty > 0)) continue;
    if (!orderableTwIds.has(twId)) out.push(twId);
  }
  return out;
}

export function enrichSnapshotPackagingErrorMessage(
  baseMessage: string,
  doc: SubiektDocument,
  orderableTwIds: ReadonlySet<number>
): string {
  const foreign = twIdsOnDocOutsideOrderable(doc, orderableTwIds);
  if (!foreign.length) return baseMessage;
  const sample = foreign.slice(0, 6).join(", ");
  const more = foreign.length > 6 ? ` (+${foreign.length - 6})` : "";
  return `${baseMessage} Pozycje spoza bieżącej listy Do ZD: ${sample}${more}.`;
}
