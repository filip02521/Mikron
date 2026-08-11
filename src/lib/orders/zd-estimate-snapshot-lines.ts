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

export function buildZdEstimateSnapshotLinesFromDoc(
  doc: SubiektDocument,
  options: {
    packagingByTwId?: ReadonlyMap<number, number> | null;
    pairRatioByTwId?: ReadonlyMap<number, number> | null;
    lineMeta?: readonly ZdEstimateSnapshotLineMeta[] | null;
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
    requirePackaging?: boolean;
  } = {}
): BuildZdEstimateSnapshotLinesResult {
  const packagingByTwId = options.packagingByTwId ?? new Map<number, number>();
  const pairRatioByTwId = options.pairRatioByTwId ?? new Map<number, number>();
  const requirePackaging = options.requirePackaging === true;
  const metaByTw = new Map<
    number,
    { celAtLink?: number | null; deltaAtLink?: number | null }
  >();
  for (const m of options.lineMeta ?? []) {
    const twId = Math.trunc(Number(m.twId));
    if (twId > 0) metaByTw.set(twId, m);
  }

  const missingPack: number[] = [];
  const lines: ZdEstimateSnapshotLineBuilt[] = [];

  for (const l of doc.dok_Pozycja ?? []) {
    const twId = Math.trunc(Number(l.ob_TowId ?? 0));
    if (!(twId > 0)) continue;
    const docQty = Number(l.ob_Ilosc) || 0;
    if (!(docQty > 0)) continue;

    const meta = metaByTw.get(twId);
    const pairRatio = pairRatioByTwId.get(twId);
    const hasPairRatio =
      pairRatio != null && Number.isFinite(pairRatio) && pairRatio > 0;
    const packFromTable = packagingByTwId.get(twId);
    const hasPackaging =
      packFromTable != null &&
      Number.isFinite(packFromTable) &&
      packFromTable > 0;

    if (requirePackaging && !hasPairRatio && !hasPackaging) {
      missingPack.push(twId);
      continue;
    }

    const pack = hasPairRatio
      ? pairRatio!
      : hasPackaging
        ? packFromTable!
        : 1;

    lines.push({
      twId,
      twSymbol: l.tw_Symbol?.trim() || null,
      twNazwa: l.tw_Nazwa?.trim() || null,
      qty: zdDocumentUnitsToPieces(docQty, pack),
      celAtLink: meta?.celAtLink ?? null,
      deltaAtLink: meta?.deltaAtLink ?? null,
      ratioAtLink: hasPairRatio ? pairRatio! : null,
    });
  }

  if (missingPack.length > 0) {
    const sample = missingPack.slice(0, 8).join(", ");
    const more =
      missingPack.length > 8 ? ` (+${missingPack.length - 8})` : "";
    return {
      ok: false,
      message: `Brak opakowania (lub ratio pary) dla tw_Id: ${sample}${more}. Uzupełnij opakowania przed zapisem historii — bez cichego ×1.`,
    };
  }

  return { ok: true, lines };
}
