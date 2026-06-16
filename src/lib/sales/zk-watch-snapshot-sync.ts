import { computeZkWatchOrderHints, type ZkLinkableOrder } from "@/lib/sales/zk-watch-order-link";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import {
  applyZkWatchRefreshNewLines,
} from "@/lib/sales/zk-watch-new-lines-state";
import {
  computeZkWatchRefreshDiff,
  hasZkWatchRefreshDiff,
  shouldPromptZkRefreshSupplement,
  uncoveredAddedLineKeys,
  type ZkWatchRefreshDiff,
} from "@/lib/sales/zk-watch-refresh-diff";
import type { SalesZkWatch } from "@/types/database";

export type ZkWatchSnapshotSyncChange = {
  previous: SalesZkWatch;
  next: SalesZkWatch;
  diff: ZkWatchRefreshDiff;
};

export function zkWatchSnapshotFingerprint(
  watch: Pick<SalesZkWatch, "subiekt_snapshot" | "line_summary">
): string {
  return JSON.stringify({
    snapshot: watch.subiekt_snapshot ?? null,
    lineSummary: watch.line_summary ?? null,
  });
}

export function detectZkWatchSnapshotSyncChanges(
  previousWatches: SalesZkWatch[],
  incomingWatches: SalesZkWatch[]
): ZkWatchSnapshotSyncChange[] {
  const previousById = new Map(previousWatches.map((watch) => [watch.id, watch]));
  const changes: ZkWatchSnapshotSyncChange[] = [];

  for (const next of incomingWatches) {
    if (next.closed_at || next.archived_at) continue;
    const previous = previousById.get(next.id);
    if (!previous) continue;
    if (zkWatchSnapshotFingerprint(previous) === zkWatchSnapshotFingerprint(next)) continue;

    const previousUpdatedAt = Date.parse(previous.updated_at);
    const nextUpdatedAt = Date.parse(next.updated_at);
    if (
      Number.isFinite(previousUpdatedAt) &&
      Number.isFinite(nextUpdatedAt) &&
      nextUpdatedAt < previousUpdatedAt
    ) {
      continue;
    }

    const diff = computeZkWatchRefreshDiff(previous, next);
    if (!hasZkWatchRefreshDiff(diff)) continue;
    changes.push({ previous, next, diff });
  }

  return changes;
}

export type ZkWatchSupplementSyncResult = {
  mergedNewLineKeys: string[];
  uncoveredAdded: string[];
  newlyUncoveredAdded: string[];
  shouldPrompt: boolean;
};

export function computeZkWatchSupplementSync(options: {
  watch: SalesZkWatch;
  diff: ZkWatchRefreshDiff;
  orders: ZkLinkableOrder[];
  salesPersonId: string;
  existingNewLineKeys: string[];
}): ZkWatchSupplementSyncResult {
  const hints = computeZkWatchOrderHints(options.watch, options.orders);
  const uncoveredAdded = uncoveredAddedLineKeys(options.diff, hints.uncoveredLineKeys);
  const newlyUncoveredAdded = uncoveredAdded.filter(
    (key) => !options.existingNewLineKeys.includes(key)
  );
  const validLineKeys = new Set(buildZkWatchLineViews(options.watch).map((line) => line.key));

  const mergedNewLineKeys = applyZkWatchRefreshNewLines({
    salesPersonId: options.salesPersonId,
    watchId: options.watch.id,
    diff: options.diff,
    uncoveredAdded,
    uncoveredLineKeys: hints.uncoveredLineKeys,
    validLineKeys,
  });

  const shouldPrompt =
    newlyUncoveredAdded.length > 0 &&
    shouldPromptZkRefreshSupplement({
      diff: options.diff,
      uncoveredLineKeys: hints.uncoveredLineKeys,
    });

  return {
    mergedNewLineKeys,
    uncoveredAdded,
    newlyUncoveredAdded,
    shouldPrompt,
  };
}
