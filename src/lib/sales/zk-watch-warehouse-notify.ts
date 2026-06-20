import { parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

export function countArrivedZkLinesFromWatch(
  watch: Pick<SalesZkWatch, "line_checks">
): number {
  return parseZkWatchLineChecks(watch.line_checks).filter(
    (c) => c.arrived && c.completed_manually
  ).length;
}

/** Pozycje odebrane z regału (potwierdzenie w Moje). */
export function countInStockZkLines(inStockLineKeys: string[] | undefined): number {
  return inStockLineKeys?.length ?? 0;
}

/** Pozycje czekające na regale — dostawa z prośby bez odbioru w Moje. */
export function countRegalWaitingZkLines(regalWaitingLineKeys: string[] | undefined): number {
  return regalWaitingLineKeys?.length ?? 0;
}

export function buildZkRegalWaitingSnapshot(
  watches: SalesZkWatch[],
  regalWaitingLineKeysByWatchId: Record<string, string[]>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    out[watch.id] = countRegalWaitingZkLines(regalWaitingLineKeysByWatchId[watch.id]);
  }
  return out;
}

export function buildZkInStockSnapshot(
  watches: SalesZkWatch[],
  regalWaitingLineKeysByWatchId: Record<string, string[]>
): Record<string, number> {
  return buildZkRegalWaitingSnapshot(watches, regalWaitingLineKeysByWatchId);
}

export function buildZkArrivedSnapshot(
  watches: SalesZkWatch[],
  regalWaitingLineKeysByWatchId: Record<string, string[]> = {}
): Record<string, number> {
  return buildZkRegalWaitingSnapshot(watches, regalWaitingLineKeysByWatchId);
}

/** ZK z większą liczbą pozycji na regale niż w poprzednim snapshotcie. */
export function detectUnseenZkWarehouseArrivals(
  watches: SalesZkWatch[],
  previousSnapshot: Record<string, number>,
  regalWaitingLineKeysByWatchId: Record<string, string[]> = {}
): string[] {
  const unseen: string[] = [];
  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    const prev = previousSnapshot[watch.id] ?? 0;
    const now = countRegalWaitingZkLines(regalWaitingLineKeysByWatchId[watch.id]);
    if (now > prev) unseen.push(watch.id);
  }
  return unseen;
}

export type ZkWatchActivityRow = Pick<SalesZkWatch, "updated_at" | "line_checks">;

/** Skrót aktywności ZK — zmiana przy edycji watch lub odhaczeniu pozycji. */
export function computeZkWatchActivityVersion(watches: ZkWatchActivityRow[]): string {
  let maxUpdated = "";
  let arrivedTotal = 0;
  for (const watch of watches) {
    if (watch.updated_at > maxUpdated) maxUpdated = watch.updated_at;
    arrivedTotal += countArrivedZkLinesFromWatch(watch);
  }
  return `${watches.length}|${maxUpdated}|${arrivedTotal}`;
}
