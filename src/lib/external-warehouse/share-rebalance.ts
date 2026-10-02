import { comparePalletLabels } from "@/lib/external-warehouse/pallet-label-sort";

export type RebalanceShare = {
  pallet_label: string;
  qty: number;
  note: string | null;
};

export type ShareRebalancePlan = {
  /** Udziały po korekcie (kolejność palet jak w UI). */
  keep: RebalanceShare[];
  /** Palety zdjęte w całości (z notatką — trafia do dziennika, żeby nie zginęła). */
  removed: RebalanceShare[];
  /** Palety ze zmniejszoną ilością. */
  reduced: { pallet_label: string; from: number; to: number }[];
  /** Ile sztuk zdjęto łącznie. */
  trimmed: number;
};

function roundQty(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Korekta rozbicia na palety, gdy ZK ma mniej sztuk niż suma udziałów
 * (np. ilość w Subiekcie zmniejszona z 1008 do 504 przy paletach 504 + 504).
 *
 * Nadmiar zdejmujemy od ostatniej palety (najwyższa etykieta: „Mikran 11” przed „Mikran 10”) —
 * reguła jest przewidywalna, a każda korekta trafia do dziennika i da się ją poprawić w „Rozbij”.
 * Zwraca null, gdy korekta nie jest potrzebna albo nie da się jej policzyć.
 */
export function planShareRebalance(
  shares: readonly RebalanceShare[],
  lineQty: number | null
): ShareRebalancePlan | null {
  if (lineQty == null || !Number.isFinite(lineQty) || lineQty <= 0 || !shares.length) return null;
  const total = roundQty(shares.reduce((sum, s) => sum + Number(s.qty || 0), 0));
  let excess = roundQty(total - lineQty);
  if (excess <= 1e-9) return null;

  const ordered = [...shares].sort((a, b) => comparePalletLabels(a.pallet_label, b.pallet_label));
  const keep = ordered.map((s) => ({ ...s, qty: Number(s.qty) }));
  const removed: RebalanceShare[] = [];
  const reduced: ShareRebalancePlan["reduced"] = [];

  for (let i = keep.length - 1; i >= 0 && excess > 1e-9; i--) {
    const share = keep[i]!;
    if (share.qty <= excess + 1e-9) {
      excess = roundQty(excess - share.qty);
      removed.unshift(share);
      keep.splice(i, 1);
    } else {
      const to = roundQty(share.qty - excess);
      reduced.unshift({ pallet_label: share.pallet_label, from: share.qty, to });
      share.qty = to;
      excess = 0;
    }
  }

  return { keep, removed, reduced, trimmed: roundQty(total - lineQty) };
}

function formatQty(n: number): string {
  return n === Math.trunc(n) ? String(Math.trunc(n)) : String(n);
}

/** Opis korekty do dziennika: „zdjęto paletę „Mikran 11” (504 szt.)”. */
export function describeShareRebalance(plan: ShareRebalancePlan): string {
  const parts = [
    ...plan.removed.map((s) => `zdjęto paletę „${s.pallet_label}” (${formatQty(s.qty)} szt.)`),
    ...plan.reduced.map((r) => `„${r.pallet_label}” ${formatQty(r.from)} → ${formatQty(r.to)} szt.`),
  ];
  return parts.join(", ");
}
