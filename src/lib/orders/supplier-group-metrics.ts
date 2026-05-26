import { supplierKey } from "@/lib/orders/queue-supplier-groups";
import type { IndividualOrder } from "@/types/database";

export type SupplierGroupMetrics = {
  queue: number;
  shelf: number;
  partial: number;
};

export function buildSupplierGroupMetrics(
  queueOrders: IndividualOrder[],
  shelfOrders: IndividualOrder[] = []
): Map<string, SupplierGroupMetrics> {
  const map = new Map<string, SupplierGroupMetrics>();

  const bump = (key: string, patch: Partial<SupplierGroupMetrics>) => {
    const cur = map.get(key) ?? { queue: 0, shelf: 0, partial: 0 };
    map.set(key, {
      queue: cur.queue + (patch.queue ?? 0),
      shelf: cur.shelf + (patch.shelf ?? 0),
      partial: cur.partial + (patch.partial ?? 0),
    });
  };

  for (const o of queueOrders) {
    const key = supplierKey(o);
    bump(key, {
      queue: 1,
      partial: o.status === "Czesciowo_zrealizowane" ? 1 : 0,
    });
  }

  for (const o of shelfOrders) {
    bump(supplierKey(o), { shelf: 1 });
  }

  return map;
}

/** Krótki opis do nagłówka grupy — liczby z widocznej grupy + kontekst magazynu/kolejki. */
export function formatSupplierGroupHeaderSummary(
  groupOrders: IndividualOrder[],
  globalMetrics?: SupplierGroupMetrics
): string {
  const parts: string[] = [
    `${groupOrders.length} ${groupOrders.length === 1 ? "poz." : "poz."}`,
  ];
  const partialInGroup = groupOrders.filter(
    (o) => o.status === "Czesciowo_zrealizowane"
  ).length;
  if (partialInGroup > 0) {
    parts.push(`${partialInGroup} częściowo`);
  }
  if (globalMetrics?.shelf) {
    parts.push(`${globalMetrics.shelf} na regale`);
  }
  if (globalMetrics?.queue && globalMetrics.queue > groupOrders.length) {
    parts.push(`${globalMetrics.queue} w kolejce`);
  }
  return parts.join(" · ");
}
