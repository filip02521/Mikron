import type { SalesZkWatch } from "@/types/database";

export function watchFocusOpensSections(
  watchId: string,
  watches: SalesZkWatch[],
  archived: SalesZkWatch[]
): { showZk: boolean; showArchive: boolean } {
  return {
    showZk: watches.some((watch) => watch.id === watchId),
    showArchive: archived.some((watch) => watch.id === watchId),
  };
}

export function resolveWatchFocusRequest(
  watchId: string,
  watches: SalesZkWatch[],
  archived: SalesZkWatch[]
):
  | { kind: "found"; showZk: boolean; showArchive: boolean }
  | { kind: "missing" } {
  const trimmed = watchId.trim();
  if (!trimmed) return { kind: "missing" };

  const sections = watchFocusOpensSections(trimmed, watches, archived);
  if (!sections.showZk && !sections.showArchive) {
    return { kind: "missing" };
  }
  return { kind: "found", ...sections };
}
