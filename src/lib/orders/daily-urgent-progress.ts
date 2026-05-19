export type DailyUrgentProgress = {
  /** Łącznie do zamknięcia dziś (harmonogram zaległe + na dziś) */
  total: number;
  /** Już oznaczone / zniknęły z listy */
  done: number;
  /** Zostało na liście */
  remaining: number;
  /** 0–100 */
  percent: number;
  complete: boolean;
  hasWork: boolean;
};

/** Czysta logika postępu — do testów i hooka. */
export function computeDailyUrgentProgress(
  baseline: number | null,
  remaining: number
): DailyUrgentProgress {
  const total = baseline ?? (remaining > 0 ? remaining : 0);
  const done = Math.max(0, total - remaining);
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const complete = total > 0 && remaining === 0;
  const hasWork = total > 0;

  return {
    total,
    done,
    remaining,
    percent,
    complete,
    hasWork,
  };
}

export function mergeUrgentBaseline(
  stored: number | null,
  remaining: number
): number | null {
  if (stored != null) {
    return Math.max(stored, remaining);
  }
  return remaining > 0 ? remaining : null;
}
