import { buildZkWatchLineViews, parseZkWatchLineChecks } from "@/lib/sales/zk-watch-lines";
import { needsProsbaByKeyFromChecks } from "@/lib/sales/zk-watch-prosba-scope";
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

/**
 * Nowe pozycje ZK wymagające decyzji w modalu uzupełnienia prośby.
 * Obejmuje niepokryte prośbą oraz świeżo dodane bez zapisanego needs_prosba.
 */
export function addedLineKeysForSupplementPrompt(
  diff: ZkWatchRefreshDiff,
  watch: Pick<SalesZkWatch, "line_checks" | "subiekt_snapshot" | "line_summary">,
  uncoveredLineKeys: string[]
): string[] {
  if (!diff.addedLineKeys.length) return [];
  const views = buildZkWatchLineViews(watch as SalesZkWatch).filter((v) => v.key !== "summary");
  const viewKeys = new Set(views.map((v) => v.key));
  const needsByKey = needsProsbaByKeyFromChecks(parseZkWatchLineChecks(watch.line_checks));
  const uncovered = new Set(uncoveredLineKeys);

  return diff.addedLineKeys.filter((key) => {
    if (!viewKeys.has(key)) return false;
    if (needsByKey.get(key) === false) return false;
    if (uncovered.has(key)) return true;
    return !needsByKey.has(key);
  });
}

/** Gdy wszystko na stanie i jest otwarta prośba — przekieruj tylko bez ręcznego wyboru pozycji. */
export function shouldRedirectZkRefreshToOpenProsba(input: {
  allOnStock: boolean;
  hasOpenMatchingProsba: boolean;
  linesToAddCount: number;
}): boolean {
  return (
    input.allOnStock && input.hasOpenMatchingProsba && input.linesToAddCount === 0
  );
}

export function shouldPromptZkRefreshSupplement(options: {
  diff: ZkWatchRefreshDiff;
  watch: Pick<SalesZkWatch, "line_checks" | "subiekt_snapshot" | "line_summary">;
  uncoveredLineKeys: string[];
}): boolean {
  return (
    addedLineKeysForSupplementPrompt(
      options.diff,
      options.watch,
      options.uncoveredLineKeys
    ).length > 0
  );
}
