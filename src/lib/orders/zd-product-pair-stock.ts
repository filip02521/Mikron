import { fetchZdProductPairs } from "@/lib/data/zd-product-pairs";
import {
  indexZdProductPairs,
  twinTwIdsForPairMatch,
  type ZdProductPairRole,
} from "@/lib/orders/zd-product-pair-units";
import type { ZdPairMatchIndex } from "@/lib/subiekt/match-order-to-zd";
import type { ProsbaLineStockSnapshot } from "@/lib/orders/prosba-stock-check";

export type LoadZdPairMatchIndexResult = {
  pairs: ZdPairMatchIndex;
  /** Ustawione gdy odczyt tabeli par się nie udał (fail-loud). */
  error: string | null;
};

/** Ładuje indeks par do match ZD / stock. */
export async function loadZdPairMatchIndex(): Promise<ZdPairMatchIndex> {
  const { pairs } = await loadZdPairMatchIndexDetailed();
  return pairs;
}

/** Jak {@link loadZdPairMatchIndex}, ale z komunikatem błędu (bez cichego pustego indeksu). */
export async function loadZdPairMatchIndexDetailed(): Promise<LoadZdPairMatchIndexResult> {
  try {
    const rows = await fetchZdProductPairs();
    return { pairs: indexZdProductPairs(rows), error: null };
  } catch (e) {
    return {
      pairs: new Map(),
      error:
        e instanceof Error
          ? e.message
          : "Nie udało się wczytać mapy par montaż/demontaż.",
    };
  }
}

/**
 * Rozszerza listę tw_Id o twinów pary (żeby pobrać stany obu kart).
 */
export function expandTwIdsWithPairTwins(
  twIds: readonly number[],
  pairs: ZdPairMatchIndex
): number[] {
  const out = new Set<number>();
  for (const raw of twIds) {
    const id = Math.trunc(raw);
    if (!(id > 0)) continue;
    out.add(id);
    const hit = pairs.get(id);
    if (hit) {
      out.add(hit.pair.packTwId);
      out.add(hit.pair.pieceTwId);
    }
  }
  return [...out];
}

function num(v: number | null | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Dla SKU w parze: available = piece.available + pack.available × ratio (w jednostkach roli).
 * Zachowuje zagregowany onHand/reserved (nie zeruje rezerwacji).
 */
export function pairAwareStockSnapshotForTwId(
  twId: number,
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  pairs: ZdPairMatchIndex
): ProsbaLineStockSnapshot | null {
  const id = Math.trunc(twId);
  const hit = pairs.get(id);
  const own = stockByTwId[id];
  if (!hit) return own ?? null;

  const ratio = hit.pair.unitsPerPack;
  const pieceSnap = stockByTwId[hit.pair.pieceTwId];
  const packSnap = stockByTwId[hit.pair.packTwId];
  // Gdy brak jednej karty w fetchu — nie udawaj cover=0 z samych zer (fail-soft: własny snap).
  if (!pieceSnap && !packSnap) return own ?? null;
  if (hit.role === "piece" && !pieceSnap && !packSnap) return own ?? null;

  const pieceAvail = Math.max(0, num(pieceSnap?.available));
  const packAvail = Math.max(0, num(packSnap?.available));
  const piecesTotal = pieceAvail + packAvail * ratio;

  const pieceOnHand = Math.max(0, num(pieceSnap?.onHand));
  const packOnHand = Math.max(0, num(packSnap?.onHand));
  const pieceReserved = Math.max(0, num(pieceSnap?.reserved));
  const packReserved = Math.max(0, num(packSnap?.reserved));
  const onHandPieces = pieceOnHand + packOnHand * ratio;
  const reservedPieces = pieceReserved + packReserved * ratio;

  const role: ZdProductPairRole = hit.role;
  const pairMeta = {
    pairAware: true as const,
    pairUnitsPerPack: ratio,
    pairRole: role,
  };

  if (role === "piece") {
    if (!pieceSnap && !packSnap && piecesTotal <= 0) return own ?? null;
    return {
      onHand: onHandPieces,
      reserved: reservedPieces,
      available: piecesTotal,
      source: "subiekt",
      ...pairMeta,
    };
  }

  const packsAvailable = Math.floor(piecesTotal / ratio);
  const packsOnHand = Math.floor(onHandPieces / ratio);
  const packsReserved = Math.floor(reservedPieces / ratio);
  if (!packSnap && !pieceSnap && packsAvailable <= 0) return own ?? null;
  return {
    onHand: packsOnHand,
    reserved: packsReserved,
    available: packsAvailable,
    source: "subiekt",
    ...pairMeta,
  };
}

/** Nadpisuje stockByTwId wartościami pair-aware dla wszystkich kluczy w parze. */
export function applyPairAwareStockMap(
  stockByTwId: Record<number, ProsbaLineStockSnapshot>,
  pairs: ZdPairMatchIndex
): Record<number, ProsbaLineStockSnapshot> {
  if (pairs.size === 0) return stockByTwId;
  const out = { ...stockByTwId };
  const seen = new Set<number>();
  for (const twId of pairs.keys()) {
    if (seen.has(twId)) continue;
    const hit = pairs.get(twId)!;
    seen.add(hit.pair.packTwId);
    seen.add(hit.pair.pieceTwId);
    const pieceAware = pairAwareStockSnapshotForTwId(
      hit.pair.pieceTwId,
      stockByTwId,
      pairs
    );
    const packAware = pairAwareStockSnapshotForTwId(
      hit.pair.packTwId,
      stockByTwId,
      pairs
    );
    if (pieceAware) out[hit.pair.pieceTwId] = pieceAware;
    if (packAware) out[hit.pair.packTwId] = packAware;
  }
  return out;
}

/** Czy tw_Id A i B są twinami w indeksie par. */
export function twIdsArePairTwins(
  a: number,
  b: number,
  pairs: ZdPairMatchIndex
): boolean {
  const twins = twinTwIdsForPairMatch(a, pairs);
  return twins.includes(Math.trunc(b));
}
