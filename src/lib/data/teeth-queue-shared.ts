/** Typy i helpery kolejki zębów — bezpieczne dla klienta (bez Supabase). */

import type { IndividualOrder } from "@/types/database";

export const TEETH_QUEUE_PENDING_STATUSES = ["Nowe", "Weryfikacja"] as const;

export const TEETH_HISTORY_PAGE_SIZE = 50;

export type TeethSupplierDeliveryEta = {
  expectedDate: string;
  avgBusinessDays: number;
  sampleCount: number;
  lowConfidence: boolean;
  source: "fixed" | "history";
};

export type TeethQueueItem = IndividualOrder & {
  supplier_name: string | null;
  sales_person_name: string | null;
};

/** Pozycja z harmonogramu zębów — nie jest prawdziwym zamówieniem, ale zadaniem do zamówienia u dostawcy. */
export type TeethScheduledItem = {
  id: string;
  supplier_id: string;
  supplier_name: string;
  computed_next_date: string | null;
  shift_date: string | null;
  vacation_note: string | null;
  is_scheduled: true;
};

export type TeethQueueEntry = TeethQueueItem | TeethScheduledItem;

export function isScheduledItem(entry: TeethQueueEntry): entry is TeethScheduledItem {
  return (entry as TeethScheduledItem).is_scheduled === true;
}

export type TeethQueueGroup = {
  supplierId: string | null;
  supplierName: string;
  items: TeethQueueEntry[];
  /** Czy grupa zawiera tylko zaplanowane pozycje (bez prawdziwych zamówień). */
  scheduledOnly: boolean;
  /** Cykl z harmonogramu przypadający na dziś — także gdy są prośby handlowców. */
  dueSchedule?: TeethScheduledItem | null;
  /** Szacowana dostawa po zamówieniu (na podstawie historii zębów u dostawcy). */
  deliveryEta?: TeethSupplierDeliveryEta | null;
};

export type TeethPositionSelection = {
  orderId: string;
  positions: number[];
};

/** Grupuje pozycje zębów wg dostawcy (kolejka / historia). */
export function groupTeethItemsBySupplier(items: TeethQueueItem[]): TeethQueueGroup[] {
  const groupsMap = new Map<string, TeethQueueGroup>();
  for (const item of items) {
    const key = item.supplier_id ?? "__no_supplier";
    const existing = groupsMap.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groupsMap.set(key, {
        supplierId: item.supplier_id,
        supplierName: item.supplier_name ?? "Bez dostawcy",
        items: [item],
        scheduledOnly: false,
      });
    }
  }
  return Array.from(groupsMap.values()).sort((a, b) =>
    a.supplierName.localeCompare(b.supplierName, "pl")
  );
}
