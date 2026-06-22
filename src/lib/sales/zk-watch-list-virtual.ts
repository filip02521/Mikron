import type { ZkWatchMonthGroup } from "@/lib/sales/zk-watch-sort";
import { isZkMonthGroupExpanded } from "@/lib/sales/zk-watch-month-collapse";
import type { SalesZkWatch } from "@/types/database";

export type ZkWatchListVirtualItem =
  | {
      kind: "month";
      key: string;
      group: ZkWatchMonthGroup;
      isOpen: boolean;
    }
  | {
      kind: "watch";
      key: string;
      watch: SalesZkWatch;
      groupKey: string;
    };

export function buildZkWatchListVirtualItems(input: {
  groups: ZkWatchMonthGroup[];
  collapsedMonths: Set<string>;
  openModalWatchId: string | null;
}): ZkWatchListVirtualItem[] {
  const { groups, collapsedMonths, openModalWatchId } = input;
  const items: ZkWatchListVirtualItem[] = [];

  for (const group of groups) {
    const isOpen = isZkMonthGroupExpanded(group.key, collapsedMonths);
    items.push({
      kind: "month",
      key: `month:${group.key}`,
      group,
      isOpen,
    });

    for (const watch of group.watches) {
      const modalPinned = openModalWatchId === watch.id;
      if (!isOpen && !modalPinned) continue;
      items.push({
        kind: "watch",
        key: `watch:${watch.id}`,
        watch,
        groupKey: group.key,
      });
    }
  }

  return items;
}

export function zkWatchListScrollKey(watchId: string): string {
  return `watch:${watchId}`;
}
