/**
 * „Tylko na prośbę” — soft-exclude bez prośby; z prośbą qty = extra_only.
 * Trzy zestawy exclude (bake / order / reclassify) — nie jeden effectiveExcluded.
 */

/** Jeśli tw jest piece w aktywnej parze → kanoniczny pack (prośby / Do ZD idą na pack). */
export function retargetTwIdToPackIfPiece(
  twId: number,
  pairs: readonly { packTwId: number; pieceTwId: number }[]
): { twId: number; retargeted: boolean; pair: { packTwId: number; pieceTwId: number } | null } {
  const id = Math.trunc(Number(twId));
  if (!Number.isFinite(id) || id <= 0) {
    return { twId: id, retargeted: false, pair: null };
  }
  for (const pair of pairs) {
    const piece = Math.trunc(Number(pair.pieceTwId));
    const pack = Math.trunc(Number(pair.packTwId));
    if (piece === id && Number.isFinite(pack) && pack > 0) {
      return { twId: pack, retargeted: true, pair: { packTwId: pack, pieceTwId: piece } };
    }
  }
  return { twId: id, retargeted: false, pair: null };
}

export function onRequestTwIdSet(
  rows: readonly { subiektTwId: number }[] | null | undefined,
  /** Gdy podane — piece z aktywnej pary mapowany na pack (kolejność „wpis → para” nie psuje soft/lift). */
  pairs?: readonly { packTwId: number; pieceTwId: number }[] | null
): Set<number> {
  const set = new Set<number>();
  for (const row of rows ?? []) {
    const raw = Math.trunc(Number(row.subiektTwId));
    if (!Number.isFinite(raw) || raw <= 0) continue;
    const id = pairs?.length
      ? retargetTwIdToPackIfPiece(raw, pairs).twId
      : raw;
    if (Number.isFinite(id) && id > 0) set.add(id);
  }
  return set;
}

/** Id do skasowania przy jawnym „Usuń tylko na prośbę” (oryginał + partnerzy pary). */
export function onRequestIdsToClearForTw(
  twId: number,
  pairs: readonly { packTwId: number; pieceTwId: number }[]
): number[] {
  const raw = Math.trunc(Number(twId));
  if (!Number.isFinite(raw) || raw <= 0) return [];
  const ids = new Set<number>([raw]);
  const hit = retargetTwIdToPackIfPiece(raw, pairs);
  if (hit.retargeted) ids.add(hit.twId);
  for (const pair of pairs) {
    const pack = Math.trunc(Number(pair.packTwId));
    const piece = Math.trunc(Number(pair.pieceTwId));
    if (pack === raw || piece === raw || pack === hit.twId) {
      if (Number.isFinite(pack) && pack > 0) ids.add(pack);
      if (Number.isFinite(piece) && piece > 0) ids.add(piece);
    }
  }
  return [...ids];
}

/**
 * Mutual exclusivity przy hard exclude — tylko wykluczany tw (+ sieroty piece
 * gdy wykluczamy pack). Nie kasuje flagi packa przy wykluczeniu piece.
 */
export function onRequestIdsToClearForExcludedTw(
  twId: number,
  pairs: readonly { packTwId: number; pieceTwId: number }[]
): number[] {
  const raw = Math.trunc(Number(twId));
  if (!Number.isFinite(raw) || raw <= 0) return [];
  const ids = new Set<number>([raw]);
  for (const pair of pairs) {
    const pack = Math.trunc(Number(pair.packTwId));
    const piece = Math.trunc(Number(pair.pieceTwId));
    // Wykluczamy pack → usuń też piece-stored flagę (sierota przed parą).
    if (pack === raw && Number.isFinite(piece) && piece > 0) ids.add(piece);
  }
  return [...ids];
}

/** tw z dodatnią rezerwą katalogową (po piece→pack). */
export function buildExtraOnlyTwIds(
  onRequestTwIds: ReadonlySet<number>,
  individualExtraByTwId: ReadonlyMap<number, number> | null | undefined
): Set<number> {
  const out = new Set<number>();
  if (!individualExtraByTwId) return out;
  for (const twId of onRequestTwIds) {
    const extra = individualExtraByTwId.get(twId);
    if (extra != null && Number.isFinite(extra) && extra > 0) out.add(twId);
  }
  return out;
}

export function buildBakeExcludedTwIds(
  hardBase: ReadonlySet<number>,
  onRequestTwIds: ReadonlySet<number>
): Set<number> {
  const out = new Set(hardBase);
  for (const id of onRequestTwIds) out.add(id);
  return out;
}

export function buildOrderExcludedTwIds(
  hardBase: ReadonlySet<number>,
  onRequestTwIds: ReadonlySet<number>,
  extraOnlyTwIds: ReadonlySet<number>
): Set<number> {
  const out = new Set(hardBase);
  for (const id of onRequestTwIds) {
    if (!extraOnlyTwIds.has(id)) out.add(id);
  }
  return out;
}

/** To samo co orderExcluded — nigdy extraOnly. */
export function buildReclassifyExcludedTwIds(
  hardBase: ReadonlySet<number>,
  onRequestTwIds: ReadonlySet<number>,
  extraOnlyTwIds: ReadonlySet<number>
): Set<number> {
  return buildOrderExcludedTwIds(hardBase, onRequestTwIds, extraOnlyTwIds);
}

/**
 * Session include nie zdejmuje on-request (pełny stock byłby błędem).
 * Usuwa z session tylko id spoza onRequest.
 */
export function filterSessionIncludeRespectingOnRequest(
  sessionIncludeTwIds: ReadonlySet<number> | readonly number[] | Record<number, true>,
  onRequestTwIds: ReadonlySet<number>
): Set<number> {
  const raw =
    sessionIncludeTwIds instanceof Set
      ? sessionIncludeTwIds
      : Array.isArray(sessionIncludeTwIds)
        ? new Set(sessionIncludeTwIds)
        : new Set(
            Object.keys(sessionIncludeTwIds as Record<number, true>).map(Number)
          );
  const out = new Set<number>();
  for (const id of raw) {
    if (!onRequestTwIds.has(id)) out.add(id);
  }
  return out;
}
