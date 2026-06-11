import { zkNumbersEquivalent } from "@/lib/subiekt/zk-document";

type ZkNumberRow = { zk_number: string; id?: string };

/** Dopasowanie numeru ZK z URL / wyszukiwarki do wpisu w notatniku (formaty Subiekta). */
export function findZkWatchByNumber<T extends ZkNumberRow>(
  watches: T[],
  zkNumber: string
): T | null {
  const trimmed = zkNumber.trim();
  if (!trimmed) return null;

  const exact = watches.find((w) => w.zk_number.trim() === trimmed);
  if (exact) return exact;

  return watches.find((w) => zkNumbersEquivalent(w.zk_number, trimmed)) ?? null;
}
