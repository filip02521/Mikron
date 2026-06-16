import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

export type ZkWatchRefreshDiff = {
  addedLineKeys: string[];
  removedLineKeys: string[];
  quantityChanged: { key: string; from: number | null; to: number | null }[];
};

export const EMPTY_ZK_WATCH_REFRESH_DIFF: ZkWatchRefreshDiff = {
  addedLineKeys: [],
  removedLineKeys: [],
  quantityChanged: [],
};

export function computeZkWatchRefreshDiff(
  previous: Pick<SalesZkWatch, "subiekt_snapshot" | "line_summary">,
  next: Pick<SalesZkWatch, "subiekt_snapshot" | "line_summary">
): ZkWatchRefreshDiff {
  const prevViews = buildZkWatchLineViews(previous as SalesZkWatch);
  const nextViews = buildZkWatchLineViews(next as SalesZkWatch);

  const prevByKey = new Map(prevViews.map((v) => [v.key, v.quantity]));
  const nextByKey = new Map(nextViews.map((v) => [v.key, v.quantity]));

  const addedLineKeys: string[] = [];
  const removedLineKeys: string[] = [];
  const quantityChanged: ZkWatchRefreshDiff["quantityChanged"] = [];

  for (const key of nextByKey.keys()) {
    if (!prevByKey.has(key)) addedLineKeys.push(key);
  }
  for (const key of prevByKey.keys()) {
    if (!nextByKey.has(key)) removedLineKeys.push(key);
  }
  for (const [key, toQty] of nextByKey) {
    if (!prevByKey.has(key)) continue;
    const fromQty = prevByKey.get(key) ?? null;
    if (fromQty !== toQty) {
      quantityChanged.push({ key, from: fromQty, to: toQty ?? null });
    }
  }

  return { addedLineKeys, removedLineKeys, quantityChanged };
}

export function hasZkWatchRefreshDiff(diff: ZkWatchRefreshDiff): boolean {
  return (
    diff.addedLineKeys.length > 0 ||
    diff.removedLineKeys.length > 0 ||
    diff.quantityChanged.length > 0
  );
}

export function uncoveredAddedLineKeys(
  diff: ZkWatchRefreshDiff,
  uncoveredLineKeys: string[]
): string[] {
  if (!diff.addedLineKeys.length || !uncoveredLineKeys.length) return [];
  const uncovered = new Set(uncoveredLineKeys);
  return diff.addedLineKeys.filter((key) => uncovered.has(key));
}

export function shouldPromptZkRefreshSupplement(options: {
  diff: ZkWatchRefreshDiff;
  uncoveredLineKeys: string[];
}): boolean {
  return uncoveredAddedLineKeys(options.diff, options.uncoveredLineKeys).length > 0;
}
