import {
  loadZkNewLinesSnapshot,
  saveZkNewLinesSnapshot,
  type ZkNewLinesSnapshot,
} from "@/lib/client/zk-watch-new-lines-snapshot";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { ZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import type { ZkWatchRefreshDiff } from "@/lib/sales/zk-watch-refresh-diff";
import type { SalesZkWatch } from "@/types/database";

export function mergeLineKeys(existing: string[], added: string[]): string[] {
  if (!added.length) return [...new Set(existing)];
  return [...new Set([...existing, ...added])];
}

export function pruneNewLineKeysForWatch(
  lineKeys: string[],
  uncoveredLineKeys: string[],
  validLineKeys?: Set<string>
): string[] {
  const uncovered = new Set(uncoveredLineKeys);
  return lineKeys.filter((key) => uncovered.has(key) && (!validLineKeys || validLineKeys.has(key)));
}

export function buildValidLineKeysByWatchId(watches: SalesZkWatch[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const watch of watches) {
    const views = buildZkWatchLineViews(watch);
    map.set(watch.id, new Set(views.map((line) => line.key)));
  }
  return map;
}

export function reconcileZkNewLinesSnapshot(options: {
  snapshot: ZkNewLinesSnapshot;
  watches: SalesZkWatch[];
  hintsByWatchId: Map<string, ZkWatchOrderHints>;
  validLineKeysByWatchId?: Map<string, Set<string>>;
}): ZkNewLinesSnapshot {
  const { snapshot, watches, hintsByWatchId } = options;
  const validLineKeysByWatchId =
    options.validLineKeysByWatchId ?? buildValidLineKeysByWatchId(watches);
  const next: ZkNewLinesSnapshot = {};

  for (const watch of watches) {
    if (watch.closed_at || watch.archived_at) continue;
    const stored = snapshot[watch.id];
    if (!stored?.length) continue;

    const hints = hintsByWatchId.get(watch.id);
    const validLineKeys = validLineKeysByWatchId.get(watch.id) ?? new Set<string>();
    const pruned = pruneNewLineKeysForWatch(
      stored,
      hints?.uncoveredLineKeys ?? [],
      validLineKeys
    );
    if (pruned.length) next[watch.id] = pruned;
  }

  return next;
}

export function applyZkWatchRefreshNewLines(options: {
  salesPersonId: string;
  watchId: string;
  diff: ZkWatchRefreshDiff;
  uncoveredAdded: string[];
  uncoveredLineKeys: string[];
  validLineKeys: Set<string>;
}): string[] {
  const snapshot = loadZkNewLinesSnapshot(options.salesPersonId);
  let existing = snapshot[options.watchId] ?? [];

  if (options.diff.removedLineKeys.length) {
    const removed = new Set(options.diff.removedLineKeys);
    existing = existing.filter((key) => !removed.has(key));
  }

  if (options.uncoveredAdded.length) {
    existing = mergeLineKeys(existing, options.uncoveredAdded);
  }

  const pruned = pruneNewLineKeysForWatch(
    existing,
    options.uncoveredLineKeys,
    options.validLineKeys
  );

  if (pruned.length) snapshot[options.watchId] = pruned;
  else delete snapshot[options.watchId];

  saveZkNewLinesSnapshot(options.salesPersonId, snapshot);
  return pruned;
}

export function syncZkNewLinesSnapshot(
  salesPersonId: string,
  snapshot: ZkNewLinesSnapshot
): ZkNewLinesSnapshot {
  saveZkNewLinesSnapshot(salesPersonId, snapshot);
  return snapshot;
}
