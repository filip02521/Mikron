import type { TeethQueueEntry } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";

export type TeethDuplicateWarning = {
  salesPersonName: string;
  color: string;
  mould: string | null;
  jaw: string | null;
  kind: string | null;
  orderIds: string[];
};

/**
 * Wykrywa potencjalne duplikaty: ten sam handlowiec + ta sama specyfikacja zębów
 * w więcej niż jednym zamówieniu w kolejce.
 */
export function detectTeethDuplicates(
  groups: { items: TeethQueueEntry[] }[],
): TeethDuplicateWarning[] {
  const specMap = new Map<string, TeethDuplicateWarning>();

  for (const group of groups) {
    for (const item of group.items) {
      if (isScheduledItem(item)) continue;
      const salesName = item.sales_person_name ?? "—";
      const details = item.teeth_details ?? [];
      if (details.length === 0) continue;

      for (const d of details) {
        const key = `${salesName}|${d.color}|${d.mould ?? ""}|${d.jaw ?? ""}|${d.kind ?? ""}`;
        const existing = specMap.get(key);
        if (existing) {
          if (!existing.orderIds.includes(item.id)) {
            existing.orderIds.push(item.id);
          }
        } else {
          specMap.set(key, {
            salesPersonName: salesName,
            color: d.color,
            mould: d.mould,
            jaw: d.jaw,
            kind: d.kind,
            orderIds: [item.id],
          });
        }
      }
    }
  }

  return Array.from(specMap.values()).filter((w) => w.orderIds.length > 1);
}
