import type { SalesZkWatch } from "@/types/database";

export function isZkWatchArchived(
  watch: Pick<SalesZkWatch, "closed_at" | "archived_at">
): boolean {
  return Boolean(watch.closed_at || watch.archived_at);
}

export function partitionSalesZkWatches(watches: SalesZkWatch[]): {
  zkWatches: SalesZkWatch[];
  archivedZkWatches: SalesZkWatch[];
} {
  return {
    zkWatches: watches.filter((w) => !isZkWatchArchived(w)),
    archivedZkWatches: watches.filter((w) => isZkWatchArchived(w)),
  };
}
