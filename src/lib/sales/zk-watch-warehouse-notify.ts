import { parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

export function countArrivedZkLinesFromWatch(
  watch: Pick<SalesZkWatch, "line_checks">
): number {
  return parseZkWatchLineChecks(watch.line_checks).filter((c) => c.arrived).length;
}

export function buildZkArrivedSnapshot(
  watches: SalesZkWatch[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    out[watch.id] = countArrivedZkLinesFromWatch(watch);
  }
  return out;
}

/** ZK z większą liczbą odhaczonych pozycji niż w poprzednim snapshotcie. */
export function detectUnseenZkWarehouseArrivals(
  watches: SalesZkWatch[],
  previousSnapshot: Record<string, number>
): string[] {
  const unseen: string[] = [];
  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    const prev = previousSnapshot[watch.id] ?? 0;
    const now = countArrivedZkLinesFromWatch(watch);
    if (now > prev) unseen.push(watch.id);
  }
  return unseen;
}

export type ZkWatchActivityRow = Pick<SalesZkWatch, "updated_at" | "line_checks">;

/** Skrót aktywności ZK — zmiana przy auto-odhaczeniu lub edycji watch. */
export function computeZkWatchActivityVersion(watches: ZkWatchActivityRow[]): string {
  let maxUpdated = "";
  let arrivedTotal = 0;
  for (const watch of watches) {
    if (watch.updated_at > maxUpdated) maxUpdated = watch.updated_at;
    arrivedTotal += countArrivedZkLinesFromWatch(watch);
  }
  return `${watches.length}|${maxUpdated}|${arrivedTotal}`;
}
