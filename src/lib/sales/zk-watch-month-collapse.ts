import type { ZkWatchMonthGroup } from "@/lib/sales/zk-watch-sort";

export function zkWatchMonthGroupsSignature(groups: ZkWatchMonthGroup[]): string {
  return groups.map((g) => `${g.key}:${g.watches.length}`).join("\u0000");
}

/** Domyślnie wszystkie miesiące rozwinięte. */
export function defaultCollapsedZkMonthKeys(_groups: ZkWatchMonthGroup[]): Set<string> {
  void _groups;
  return new Set();
}

export function isZkMonthGroupExpanded(monthKey: string, collapsed: Set<string>): boolean {
  return !collapsed.has(monthKey);
}

export function toggleZkMonthGroupCollapsed(
  collapsed: Set<string>,
  monthKey: string
): Set<string> {
  const next = new Set(collapsed);
  if (next.has(monthKey)) next.delete(monthKey);
  else next.add(monthKey);
  return next;
}

export function expandAllZkMonthGroups(_groups: ZkWatchMonthGroup[]): Set<string> {
  void _groups;
  return new Set();
}

export function collapseAllZkMonthGroups(groups: ZkWatchMonthGroup[]): Set<string> {
  return new Set(groups.map((g) => g.key));
}

/** Zachowaj zwinięte miesiące po zmianie listy; nowe miesiące domyślnie rozwinięte. */
export function mergeZkMonthCollapseOnGroupsChange(
  previous: Set<string>,
  groups: ZkWatchMonthGroup[]
): Set<string> {
  const validKeys = new Set(groups.map((g) => g.key));
  const next = new Set<string>();
  for (const key of previous) {
    if (validKeys.has(key)) next.add(key);
  }
  return next;
}

export function monthKeyForWatchInGroups(
  groups: ZkWatchMonthGroup[],
  watchId: string
): string | null {
  for (const group of groups) {
    if (group.watches.some((watch) => watch.id === watchId)) {
      return group.key;
    }
  }
  return null;
}

export function expandMonthGroupKey(collapsed: Set<string>, monthKey: string): Set<string> {
  if (!collapsed.has(monthKey)) return collapsed;
  const next = new Set(collapsed);
  next.delete(monthKey);
  return next;
}
