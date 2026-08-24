/**
 * Deduplikacja Do ZD: prośba indywidualna vs rezerwacja ZK tego samego klienta.
 *
 * Stock need już rośnie przez tw_StanRez (dostepne = stan − rez).
 * Extra z prośby przy policy `sum` dolicza się „na wierzchu”.
 *
 * Reguły:
 * 1) Rezerwacja na ZK z `source_zk_number` prośby — NIE odejmuje od extra
 *    (to powód prośby). Zamiast tego ulga na stock need (żeby nie dublować
 *    need ze stanRez + extra).
 * 2) Rezerwacja na **innym** ZK tego samego kh_Id — odejmuje od extra
 *    (prawdziwe dublowanie sygnału).
 *
 * Porównanie numerów ZK: `zkNumbersEquivalent` (ten sam co w notatniku ZK),
 * nie surowy string — inaczej „153159” ≠ „ZK 153159/M/04/2026” i Do ZD spadało do 0.
 */

import { zkNumbersEquivalent } from "@/lib/subiekt/zk-document";

export type ZdEstimateProsbaOverlapContribution = {
  orderId: string;
  qty: number;
  salesClientKhId: number | null;
  sourceZkNumber: string | null;
};

export type ZdEstimateReservedOverlapSlice = {
  quantity: number;
  clientKhId: number | null;
  zkNumber: string;
};

export type ZdEstimateProsbaReservationDedupe = {
  /** Odejmij od extra (inne ZK tego samego klienta). */
  extraOverlap: number;
  /** Odejmij od stock need (własny source_zk prośby). */
  stockNeedRelief: number;
};

/** Normalizacja numeru ZK do porównania (bez prefiksu „ZK”, bez spacji). */
export function normalizeZdEstimateZkNumberKey(
  raw: string | null | undefined
): string | null {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^zk[\s./-]*/i, "")
    .replace(/\s+/g, "");
  return t || null;
}

function positiveInt(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function positiveQty(value: unknown): number {
  const n = Math.ceil(Number(value) || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function isOwnSourceZkReservation(
  sourceZkNumber: string | null | undefined,
  reservedZkNumber: string | null | undefined
): boolean {
  const a = String(sourceZkNumber ?? "").trim();
  const b = String(reservedZkNumber ?? "").trim();
  if (!a || !b) return false;
  // Obie strony: „153157” vs „ZK 153157/M/04/2026” (zkNumbersEquivalent jest niesymetryczne).
  return zkNumbersEquivalent(a, b) || zkNumbersEquivalent(b, a);
}

type PoolRow = {
  remaining: number;
  clientKhId: number | null;
  zkNumber: string;
};

/**
 * Rozbicie rezerwacji względem próśb: ulga na need (własny ZK) vs overlap extra (inne ZK).
 */
export function computeProsbaZkReservationDedupe(
  contributions: readonly ZdEstimateProsbaOverlapContribution[],
  reserved: readonly ZdEstimateReservedOverlapSlice[]
): ZdEstimateProsbaReservationDedupe {
  const pool: PoolRow[] = reserved
    .map((r) => ({
      remaining: positiveQty(r.quantity),
      clientKhId: positiveInt(r.clientKhId),
      zkNumber: String(r.zkNumber ?? "").trim(),
    }))
    .filter((r) => r.remaining > 0 && r.zkNumber);

  if (!pool.length || !contributions.length) {
    return { extraOverlap: 0, stockNeedRelief: 0 };
  }

  let extraOverlap = 0;
  let stockNeedRelief = 0;

  for (const c of contributions) {
    let left = positiveQty(c.qty);
    if (!(left > 0)) continue;
    const kh = positiveInt(c.salesClientKhId);
    const ownZk = String(c.sourceZkNumber ?? "").trim() || null;

    // 1) Własny source_zk — ulga na stock need (nie ruszaj extra).
    if (ownZk) {
      for (const r of pool) {
        if (!(left > 0)) break;
        if (!(r.remaining > 0)) continue;
        if (!isOwnSourceZkReservation(ownZk, r.zkNumber)) continue;
        const take = Math.min(left, r.remaining);
        r.remaining -= take;
        left -= take;
        stockNeedRelief += take;
      }
    }

    // 2) Inne ZK tego samego kh — overlap na extra.
    if (kh == null || !(left > 0)) continue;
    for (const r of pool) {
      if (!(left > 0)) break;
      if (r.clientKhId !== kh || !(r.remaining > 0)) continue;
      if (ownZk && isOwnSourceZkReservation(ownZk, r.zkNumber)) continue;
      const take = Math.min(left, r.remaining);
      r.remaining -= take;
      left -= take;
      extraOverlap += take;
    }
  }

  return { extraOverlap, stockNeedRelief };
}

/**
 * @deprecated Użyj `computeProsbaZkReservationDedupe` — zwraca tylko extraOverlap.
 * Zachowane dla testów / diagnostyki.
 */
export function sumProsbaZkReservationOverlapPieces(
  contributions: readonly ZdEstimateProsbaOverlapContribution[],
  reserved: readonly ZdEstimateReservedOverlapSlice[]
): number {
  return computeProsbaZkReservationDedupe(contributions, reserved).extraOverlap;
}

export function applyOverlapToExtraPieces(
  extraPieces: number,
  overlapPieces: number
): number {
  const extra = Math.max(0, Math.ceil(Number(extraPieces) || 0));
  const overlap = Math.max(0, Math.ceil(Number(overlapPieces) || 0));
  return Math.max(0, extra - overlap);
}

export type ZdEstimateTwExtraForOverlap = {
  extraPieces: number;
  overlapContributions?: readonly ZdEstimateProsbaOverlapContribution[];
};

/**
 * Czy wkład próśb może wejść w dedupe (kh_Id albo source_zk do ulgi need).
 */
export function hasMatchableProsbaOverlapIdentity(
  contributions: readonly ZdEstimateProsbaOverlapContribution[] | null | undefined
): boolean {
  for (const c of contributions ?? []) {
    if (positiveInt(c.salesClientKhId) != null) return true;
    if (normalizeZdEstimateZkNumberKey(c.sourceZkNumber)) return true;
  }
  return false;
}

export type ZdEstimateProsbaOverlapMaps = {
  /** Surowe extra (przed overlap) — overlap limitujemy w resolveOrderQty względem need. */
  extraByTwId: Map<number, number>;
  /** Overlap z innych ZK tego samego kh (jeszcze nie ograniczony do need). */
  extraOverlapByTwId: Map<number, number>;
  stockNeedReliefByTwId: Map<number, number>;
};

/**
 * Mapy tw → raw extra, overlap (inne ZK) oraz ulga stock need.
 * Ostateczne Do ZD: effectiveOverlap = min(overlap, stockNeed),
 * żeby przy need=0 (np. „tylko na prośbę”) prośba nie spadała do 0.
 */
export function individualExtrasAndReliefWithReservationOverlap(
  byTwId:
    | ReadonlyMap<number, ZdEstimateTwExtraForOverlap>
    | null
    | undefined,
  reservedByTwId:
    | ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]>
    | null
    | undefined
): ZdEstimateProsbaOverlapMaps {
  const extraByTwId = new Map<number, number>();
  const extraOverlapByTwId = new Map<number, number>();
  const stockNeedReliefByTwId = new Map<number, number>();
  if (!byTwId) {
    return { extraByTwId, extraOverlapByTwId, stockNeedReliefByTwId };
  }

  for (const [tw, extra] of byTwId) {
    if (!(extra.extraPieces > 0)) continue;
    extraByTwId.set(tw, extra.extraPieces);
    const reserved = reservedByTwId?.get(tw) ?? [];
    const dedupe =
      reserved.length > 0
        ? computeProsbaZkReservationDedupe(
            extra.overlapContributions ?? [],
            reserved
          )
        : { extraOverlap: 0, stockNeedRelief: 0 };
    if (dedupe.extraOverlap > 0) {
      extraOverlapByTwId.set(tw, dedupe.extraOverlap);
    }
    if (dedupe.stockNeedRelief > 0) {
      stockNeedReliefByTwId.set(tw, dedupe.stockNeedRelief);
    }
  }
  return { extraByTwId, extraOverlapByTwId, stockNeedReliefByTwId };
}

/**
 * Mapa tw → effective extra po odjęciu overlap (bez limitu need — legacy / ensureCover).
 * Preferuj `resolveOrderQtyForLine` z raw+overlap+relief.
 */
export function individualExtraPiecesMapWithReservationOverlap(
  byTwId:
    | ReadonlyMap<number, ZdEstimateTwExtraForOverlap>
    | null
    | undefined,
  reservedByTwId:
    | ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]>
    | null
    | undefined
): Map<number, number> {
  const maps = individualExtrasAndReliefWithReservationOverlap(
    byTwId,
    reservedByTwId
  );
  const out = new Map<number, number>();
  for (const [tw, raw] of maps.extraByTwId) {
    const overlap = maps.extraOverlapByTwId.get(tw) ?? 0;
    const effective = applyOverlapToExtraPieces(raw, overlap);
    if (effective > 0) out.set(tw, effective);
  }
  return out;
}

/** Overlap sztuk per tw (do diagnostyki / UI) — tylko część odejmowana od extra. */
export function prosbaZkReservationOverlapByTwId(
  byTwId:
    | ReadonlyMap<number, ZdEstimateTwExtraForOverlap>
    | null
    | undefined,
  reservedByTwId:
    | ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]>
    | null
    | undefined
): Map<number, number> {
  const map = new Map<number, number>();
  if (!byTwId || !reservedByTwId?.size) return map;
  for (const [tw, extra] of byTwId) {
    if (!(extra.extraPieces > 0)) continue;
    const reserved = reservedByTwId.get(tw);
    if (!reserved?.length) continue;
    const { extraOverlap } = computeProsbaZkReservationDedupe(
      extra.overlapContributions ?? [],
      reserved
    );
    if (extraOverlap > 0) map.set(tw, extraOverlap);
  }
  return map;
}

/**
 * Kandydaci do dociągnięcia ZK: extra z prośby + tw_StanRez > 0
 * (+ opcjonalnie tożsamość kh/source_zk).
 */
export function collectTwIdsNeedingProsbaReservationOverlap(input: {
  extraTwIds: Iterable<number>;
  lines: readonly { tw_Id: number; tw_StanRez?: number | null }[];
  byTwId?: ReadonlyMap<number, ZdEstimateTwExtraForOverlap> | null;
}): number[] {
  const stanRezByTw = new Map<number, number>();
  for (const line of input.lines) {
    const tw = Math.trunc(Number(line.tw_Id)) || 0;
    if (!(tw > 0)) continue;
    stanRezByTw.set(tw, Math.max(0, Number(line.tw_StanRez) || 0));
  }
  const out: number[] = [];
  const seen = new Set<number>();
  for (const raw of input.extraTwIds) {
    const tw = Math.trunc(Number(raw)) || 0;
    if (!(tw > 0) || seen.has(tw)) continue;
    if ((stanRezByTw.get(tw) ?? 0) <= 0) continue;
    if (input.byTwId) {
      const extra = input.byTwId.get(tw);
      if (!hasMatchableProsbaOverlapIdentity(extra?.overlapContributions)) {
        continue;
      }
    }
    seen.add(tw);
    out.push(tw);
  }
  return out;
}

/**
 * Kandydaci bez filtra stanRez (np. Create bez linii estimate).
 */
export function collectTwIdsNeedingProsbaReservationOverlapWithoutStanRez(input: {
  byTwId: ReadonlyMap<number, ZdEstimateTwExtraForOverlap>;
}): number[] {
  const out: number[] = [];
  for (const [tw, extra] of input.byTwId) {
    const id = Math.trunc(Number(tw)) || 0;
    if (!(id > 0)) continue;
    if (!(extra.extraPieces > 0)) continue;
    if (!hasMatchableProsbaOverlapIdentity(extra.overlapContributions)) continue;
    out.push(id);
  }
  return out;
}

export function reservedRowsToOverlapSlices(
  rows: readonly {
    quantity: number;
    clientKhId?: number | null;
    zkNumber: string;
  }[]
): ZdEstimateReservedOverlapSlice[] {
  return rows.map((r) => ({
    quantity: r.quantity,
    clientKhId: r.clientKhId ?? null,
    zkNumber: r.zkNumber,
  }));
}

/** DTO z server action → Map tw → slices. */
export function mapProsbaReservedOverlapDto(
  dto: Record<string, ZdEstimateReservedOverlapSlice[]> | null | undefined
): Map<number, ZdEstimateReservedOverlapSlice[]> {
  const out = new Map<number, ZdEstimateReservedOverlapSlice[]>();
  if (!dto) return out;
  for (const [k, slices] of Object.entries(dto)) {
    const tw = Math.trunc(Number(k)) || 0;
    if (!(tw > 0) || !Array.isArray(slices) || !slices.length) continue;
    out.set(tw, slices);
  }
  return out;
}

/**
 * Effective extras (overlap odjęty bez limitu need) — legacy.
 * UI/Create qty: `resolveProsbaReservationDedupeMaps` + `resolveOrderQtyForLine`.
 */
export function resolveIndividualExtraPiecesMap(
  byTwId:
    | ReadonlyMap<number, ZdEstimateTwExtraForOverlap>
    | null
    | undefined,
  reservedByTwId:
    | ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]>
    | null
    | undefined
): Map<number, number> {
  const maps = resolveProsbaReservationDedupeMaps(byTwId, reservedByTwId);
  const out = new Map<number, number>();
  for (const [tw, raw] of maps.extraByTwId) {
    const effective = applyOverlapToExtraPieces(
      raw,
      maps.extraOverlapByTwId.get(tw) ?? 0
    );
    if (effective > 0) out.set(tw, effective);
  }
  return out;
}

export function resolveProsbaReservationDedupeMaps(
  byTwId:
    | ReadonlyMap<number, ZdEstimateTwExtraForOverlap>
    | null
    | undefined,
  reservedByTwId:
    | ReadonlyMap<number, readonly ZdEstimateReservedOverlapSlice[]>
    | null
    | undefined
): ZdEstimateProsbaOverlapMaps {
  if (!byTwId) {
    return {
      extraByTwId: new Map(),
      extraOverlapByTwId: new Map(),
      stockNeedReliefByTwId: new Map(),
    };
  }
  if (reservedByTwId == null) {
    const extraByTwId = new Map<number, number>();
    for (const [tw, extra] of byTwId) {
      if (extra.extraPieces > 0) extraByTwId.set(tw, extra.extraPieces);
    }
    return {
      extraByTwId,
      extraOverlapByTwId: new Map(),
      stockNeedReliefByTwId: new Map(),
    };
  }
  return individualExtrasAndReliefWithReservationOverlap(byTwId, reservedByTwId);
}

/**
 * Overlap odejmowany od extra nie może przekroczyć stock need —
 * przy need=0 (extraOnly / cel pokryty) prośba zostaje w Do ZD.
 */
export function capProsbaExtraOverlapByStockNeed(
  extraOverlapPieces: number,
  stockNeedPieces: number
): number {
  const overlap = Math.max(0, Math.ceil(Number(extraOverlapPieces) || 0));
  const need = Math.max(0, Math.ceil(Number(stockNeedPieces) || 0));
  return Math.min(overlap, need);
}

export function stockNeedReliefPiecesForTw(
  twId: number,
  reliefByTwId?: ReadonlyMap<number, number> | null
): number {
  if (!reliefByTwId) return 0;
  const n = Number(reliefByTwId.get(Math.trunc(twId)));
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0;
}
