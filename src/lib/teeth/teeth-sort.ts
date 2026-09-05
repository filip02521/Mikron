import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import { isScheduledItem } from "@/lib/data/teeth-queue-shared";
import { resolveTeethQueueEnteredAt } from "@/lib/teeth/teeth-queue-wait";

export type TeethSortKey = "supplier" | "created" | "items" | "eta";

export const TEETH_SORT_LABELS: Record<TeethSortKey, string> = {
  supplier: "Dostawca (A–Z)",
  created: "Data prośby (najnowsze)",
  items: "Liczba pozycji (najwięcej)",
  eta: "ETA dostawy (najszybszy)",
};

export function sortTeethQueueGroups(
  groups: TeethQueueGroup[],
  sortKey: TeethSortKey,
): TeethQueueGroup[] {
  switch (sortKey) {
    case "supplier":
      return [...groups].sort((a, b) =>
        (a.supplierName ?? "").localeCompare(b.supplierName ?? "", "pl"),
      );

    case "created": {
      return [...groups].sort((a, b) => {
        const aNewest = Math.max(
          ...a.items
            .filter((i): i is TeethQueueItem => !isScheduledItem(i))
            .map((i) => new Date(resolveTeethQueueEnteredAt(i) ?? i.action_at).getTime() || 0),
          0,
        );
        const bNewest = Math.max(
          ...b.items
            .filter((i): i is TeethQueueItem => !isScheduledItem(i))
            .map((i) => new Date(resolveTeethQueueEnteredAt(i) ?? i.action_at).getTime() || 0),
          0,
        );
        return bNewest - aNewest;
      });
    }

    case "items": {
      return [...groups].sort((a, b) => {
        const aCount = a.items.filter((i) => !isScheduledItem(i)).length;
        const bCount = b.items.filter((i) => !isScheduledItem(i)).length;
        return bCount - aCount;
      });
    }

    case "eta": {
      return [...groups].sort((a, b) => {
        const aEta = a.deliveryEta?.avgBusinessDays ?? 999;
        const bEta = b.deliveryEta?.avgBusinessDays ?? 999;
        return aEta - bEta;
      });
    }

    default:
      return groups;
  }
}
