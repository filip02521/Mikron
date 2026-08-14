/**
 * Jednostki pary montaż/demontaż: paczka ↔ sztuki.
 * Pack SKU: qty w jednostkach paczki; piece: sztuki 1:1.
 */

export type ZdProductPairRole = "pack" | "piece";

export type ZdProductPairRef = {
  packTwId: number;
  pieceTwId: number;
  unitsPerPack: number;
};

export function normalizeUnitsPerPack(
  value: number | null | undefined
): number | null {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n) || n < 2) return null;
  return n;
}

/** Paczki (lub sztuki na piece) → sztuki bazowe. */
export function pairQtyToPieces(
  qty: number,
  role: ZdProductPairRole,
  unitsPerPack: number
): number {
  const q = Math.max(0, Number(qty) || 0);
  const ratio = normalizeUnitsPerPack(unitsPerPack) ?? 1;
  if (role === "pack" && ratio > 1) return q * ratio;
  return q;
}

/** Sztuki bazowe → jednostki paczki (ceil). */
export function piecesToPackUnits(
  pieces: number,
  unitsPerPack: number
): number {
  const p = Math.max(0, Number(pieces) || 0);
  const ratio = normalizeUnitsPerPack(unitsPerPack);
  if (!ratio) return Math.ceil(p);
  return Math.ceil(p / ratio);
}

/**
 * Dokładny przelicznik szt → op. (bez ceil) — tylko do podpowiedzi UI,
 * żeby nie sugerować „60 kartonów” gdy chodzi o 60 sztuk.
 */
export function piecesAsPackUnitsExact(
  pieces: number,
  unitsPerPack: number
): number | null {
  const ratio = normalizeUnitsPerPack(unitsPerPack);
  if (!ratio) return null;
  const p = Math.max(0, Number(pieces) || 0);
  if (!Number.isFinite(p)) return null;
  return p / ratio;
}

export type PairPiecesUiHint = {
  /** np. "60 szt" */
  piecesLabel: string;
  /** np. "≈ 1,33 op." — null gdy brak ratio */
  packsApproxLabel: string | null;
  /** Pełny title / aria */
  title: string;
};

/**
 * Etykiety UI: ilości popytu/cover pary zawsze w sztukach + przybliżenie w op.
 */
export function formatPairPiecesUiHint(
  pieces: number,
  unitsPerPack: number,
  formatQty: (n: number) => string
): PairPiecesUiHint {
  const p = Math.max(0, Number(pieces) || 0);
  const piecesLabel = `${formatQty(p)} szt`;
  const exact = piecesAsPackUnitsExact(p, unitsPerPack);
  const ratio = normalizeUnitsPerPack(unitsPerPack);
  if (exact == null || ratio == null) {
    return {
      piecesLabel,
      packsApproxLabel: null,
      title: `${piecesLabel} (jednostki sztuki, nie paczki/kartony)`,
    };
  }
  const packsApproxLabel = `≈ ${formatQty(exact)} op.`;
  return {
    piecesLabel,
    packsApproxLabel,
    title: `${piecesLabel} łącznie w parze (sztuki demontażu), nie kartony. Odpowiada ${packsApproxLabel} przy ${ratio} szt / 1 op.`,
  };
}

/**
 * Rozbicie sprzedaży pary: kanał sztuk + kanał kartonów × ratio.
 * packSprzedazOkres = sprzedaż z karty paczki w jednostkach paczki (op.).
 */
export function formatPairSalesChannelsBreakdown(
  input: {
    pieceSprzedaz: number;
    packSprzedaz: number;
    unitsPerPack: number;
    sprzedazSzt: number;
  },
  formatQty: (n: number) => string
): {
  totalLabel: string;
  channelsLabel: string;
  /** Osobne linie do UI tabeli (czytelniejszy stack niż jedna ściana tekstu). */
  channelLines: string[];
  title: string;
} {
  const ratio = normalizeUnitsPerPack(input.unitsPerPack) ?? 1;
  const piece = Math.max(0, Number(input.pieceSprzedaz) || 0);
  const packOp = Math.max(0, Number(input.packSprzedaz) || 0);
  const fromPackSzt = packOp * ratio;
  const total = Math.max(0, Number(input.sprzedazSzt) || 0);
  const totalHint = formatPairPiecesUiHint(total, ratio, formatQty);
  const channelLines: string[] = [];
  if (piece > 0) channelLines.push(`${formatQty(piece)} szt luz`);
  if (packOp > 0) {
    channelLines.push(
      `${formatQty(packOp)} op. → ${formatQty(fromPackSzt)} szt`
    );
  }
  const channelsLabel = `${formatQty(piece)} szt + ${formatQty(packOp)} op. (=${formatQty(fromPackSzt)} szt)`;
  return {
    totalLabel: totalHint.piecesLabel,
    channelsLabel,
    channelLines,
    title: [
      `Sprzedaż pary łącznie ${totalHint.piecesLabel}${totalHint.packsApproxLabel ? ` (${totalHint.packsApproxLabel})` : ""}.`,
      `Kanał sztuk: ${formatQty(piece)} szt.`,
      `Kanał kartonów: ${formatQty(packOp)} op. × ${ratio} = ${formatQty(fromPackSzt)} szt.`,
      "Suma = sztuki + kartony×ratio. Na ZD zamawiasz tylko paczki (ceil ze sztuk potrzebnych).",
    ].join(" "),
  };
}

export function resolvePairRole(
  twId: number,
  pair: ZdProductPairRef
): ZdProductPairRole | null {
  const id = Math.trunc(twId);
  if (id === pair.packTwId) return "pack";
  if (id === pair.pieceTwId) return "piece";
  return null;
}

export function twinTwId(
  twId: number,
  pair: ZdProductPairRef
): number | null {
  const role = resolvePairRole(twId, pair);
  if (role === "pack") return pair.pieceTwId;
  if (role === "piece") return pair.packTwId;
  return null;
}

/** Cover pary w sztukach (stany już w jednostkach karty: pack=paczki, piece=sztuki). */
export function pairCoverPieces(input: {
  pieceDostepne: number;
  packDostepne: number;
  unitsPerPack: number;
  packOtwarteZd?: number;
  pieceOtwarteZd?: number;
}): number {
  const ratio = normalizeUnitsPerPack(input.unitsPerPack) ?? 1;
  const piece = Math.max(0, Number(input.pieceDostepne) || 0);
  const pack = Math.max(0, Number(input.packDostepne) || 0);
  const packZd = Math.max(0, Number(input.packOtwarteZd) || 0);
  const pieceZd = Math.max(0, Number(input.pieceOtwarteZd) || 0);
  return piece + pack * ratio + packZd * ratio + pieceZd;
}

export function pairSalesPieces(input: {
  pieceSprzedazOkres: number;
  packSprzedazOkres: number;
  unitsPerPack: number;
}): number {
  const ratio = normalizeUnitsPerPack(input.unitsPerPack) ?? 1;
  const piece = Math.max(0, Number(input.pieceSprzedazOkres) || 0);
  const pack = Math.max(0, Number(input.packSprzedazOkres) || 0);
  return piece + pack * ratio;
}

/**
 * tw_Id + twin pary (do wyszukiwania ZD).
 */
export function twinTwIdsForPairMatch(
  twId: number,
  pairs?: ReadonlyMap<
    number,
    { pair: ZdProductPairRef; role: ZdProductPairRole }
  > | null
): number[] {
  const id = Math.trunc(twId);
  if (!(id > 0)) return [];
  const hit = pairs?.get(id);
  if (!hit) return [id];
  return [...new Set([hit.pair.packTwId, hit.pair.pieceTwId])];
}

/** Indeks par: tw_Id → para + rola. */
export function indexZdProductPairs<T extends ZdProductPairRef>(
  pairs: readonly T[]
): Map<number, { pair: T; role: ZdProductPairRole }> {
  const map = new Map<number, { pair: T; role: ZdProductPairRole }>();
  for (const pair of pairs) {
    const pack = Math.trunc(pair.packTwId);
    const piece = Math.trunc(pair.pieceTwId);
    if (!(pack > 0) || !(piece > 0) || pack === piece) continue;
    const ratio = normalizeUnitsPerPack(pair.unitsPerPack);
    if (!ratio) continue;
    const normalized = { ...pair, packTwId: pack, pieceTwId: piece, unitsPerPack: ratio };
    map.set(pack, { pair: normalized, role: "pack" });
    map.set(piece, { pair: normalized, role: "piece" });
  }
  return map;
}
