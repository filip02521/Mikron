/**
 * Uzgodnienie propozycji automatu po niepotwierdzonym tworzeniu ZD (timeout Subiekta): czy w Subiekcie jest ZD,
 * które z niej powstało. Czyste — dane czyta `reconcileUnconfirmedZdAutoProposals`.
 */

/** Ile towarów propozycji musi być na ZD, żeby uznać je za utworzone z niej (korekty w panelu zmieniają resztę). */
export const ZD_RECONCILE_MIN_OVERLAP = 0.8;

/** Po ilu dniach bez ZD w Subiekcie propozycja z niepotwierdzonym tworzeniem wygasa (dokumenty z dnia próby). */
export const ZD_RECONCILE_GIVE_UP_DAYS = 1;

export type ZdReconcileCandidate = { dokId: number; dokNr: string | null; qtyByTwId: ReadonlyMap<number, number> };

/**
 * ZD tego dostawcy z dnia próby, które pokrywa co najmniej 80% towarów propozycji; przy kilku — największe pokrycie,
 * a przy remisie żadne (dwa podobne ZD tego dnia to decyzja człowieka, nie automatu).
 */
export function matchZdForUnconfirmedProposal(
  proposalTwIds: readonly number[],
  candidates: readonly ZdReconcileCandidate[]
): ZdReconcileCandidate | null {
  const wanted = new Set(proposalTwIds);
  if (!wanted.size) return null;
  let best: ZdReconcileCandidate | null = null;
  let bestShare = 0;
  let tie = false;
  for (const c of candidates) {
    let hit = 0;
    for (const tw of wanted) if (c.qtyByTwId.has(tw)) hit++;
    const share = hit / wanted.size;
    if (share < ZD_RECONCILE_MIN_OVERLAP) continue;
    if (share > bestShare) {
      best = c;
      bestShare = share;
      tie = false;
    } else if (share === bestShare) tie = true;
  }
  return tie ? null : best;
}
