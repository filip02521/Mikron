export type ZdDateCandidate = {
  id: number;
  issueDate: string;
};

/** Preferuj ZD wystawione w dniu zamówienia lub tuż po nim. */
export function sortZdCandidatesByPlacementDate(
  candidates: readonly ZdDateCandidate[],
  placementDate?: string
): ZdDateCandidate[] {
  if (!placementDate?.trim()) return [...candidates];
  const targetDate = placementDate.slice(0, 10);
  const target = new Date(targetDate).getTime();
  if (!Number.isFinite(target)) return [...candidates];

  return [...candidates].sort((a, b) => {
    const da = new Date(a.issueDate).getTime();
    const db = new Date(b.issueDate).getTime();
    const aAfter = a.issueDate >= targetDate ? 0 : 1;
    const bAfter = b.issueDate >= targetDate ? 0 : 1;
    if (aAfter !== bAfter) return aAfter - bAfter;
    const score = (d: number, after: number) =>
      after === 0 ? d - target : target - d + 365 * 24 * 60 * 60 * 1000;
    return score(da, aAfter) - score(db, bAfter);
  });
}

/** Najbliższa data wystawienia względem zgłoszenia (symetrycznie przed/po). */
export function sortZdCandidatesByPlacementDistance(
  candidates: readonly ZdDateCandidate[],
  placementDate?: string
): ZdDateCandidate[] {
  if (!placementDate?.trim()) return [...candidates];
  const targetDate = placementDate.slice(0, 10);
  const target = new Date(`${targetDate}T12:00:00`).getTime();
  if (!Number.isFinite(target)) return [...candidates];

  return [...candidates].sort((a, b) => {
    const da = Math.abs(new Date(a.issueDate).getTime() - target);
    const db = Math.abs(new Date(b.issueDate).getTime() - target);
    if (da !== db) return da - db;
    return b.issueDate.localeCompare(a.issueDate);
  });
}

/**
 * Do dopasowania produktu: najpierw ZD tuż przed zgłoszeniem (np. 4 lut),
 * potem tuż po — unika zalewania wieloma ZD z tego samego dnia po zamówieniu.
 */
export function sortZdCandidatesForPlacementMatch(
  candidates: readonly ZdDateCandidate[],
  placementDate?: string
): ZdDateCandidate[] {
  if (!placementDate?.trim()) return [...candidates];
  const key = placementDate.trim().slice(0, 10);
  const before = candidates.filter((c) => c.issueDate <= key);
  const after = candidates.filter((c) => c.issueDate > key);
  before.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  after.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  return [...before, ...after];
}
