import type { TeethQueueGroup, TeethQueueItem } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";
import {
  orderTeethListReadyForOrder,
  type TeethPanelOrderLike,
  type TeethPanelReadinessContext,
} from "@/lib/teeth/teeth-panel-order-readiness";
import type { IndividualOrderTeethDetail } from "@/types/database";

export { groupTeethItemsBySupplier } from "@/lib/data/teeth-queue";

export type TeethPanelFilters = {
  supplierId: string | null;
  salesPersonId: string | null;
  missingSpecOnly: boolean;
  verificationOnly: boolean;
};

export const EMPTY_TEETH_PANEL_FILTERS: TeethPanelFilters = {
  supplierId: null,
  salesPersonId: null,
  missingSpecOnly: false,
  verificationOnly: false,
};

/** Czy pozycja ma jakąkolwiek listę zębów (nawet niekompletną). */
export function orderHasTeethList(
  order: { teeth_details?: IndividualOrderTeethDetail[] | null | undefined }
): boolean {
  return (order.teeth_details?.length ?? 0) > 0;
}

/** Czy lista zębów jest kompletna (katalog + kolor, fason, szczęka, typ). */
export function orderHasTeethSpec(
  order: TeethPanelOrderLike,
  ctx?: TeethPanelReadinessContext,
): boolean {
  return orderTeethListReadyForOrder(order, ctx);
}

/** Lista istnieje, ale brakuje parametrów wymaganych do zamówienia. */
export function orderHasIncompleteTeethSpec(
  order: TeethPanelOrderLike,
  ctx?: TeethPanelReadinessContext,
): boolean {
  return orderHasTeethList(order) && !orderHasTeethSpec(order, ctx);
}

export function countActiveTeethPanelFilters(filters: TeethPanelFilters): number {
  let n = 0;
  if (filters.supplierId) n++;
  if (filters.salesPersonId) n++;
  if (filters.missingSpecOnly) n++;
  if (filters.verificationOnly) n++;
  return n;
}

export function extractTeethFilterOptions(groups: TeethQueueGroup[]): {
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
} {
  const supplierMap = new Map<string, string>();
  const salesMap = new Map<string, string>();

  for (const group of groups) {
    if (!Array.isArray(group.items)) continue;
    if (group.supplierId) {
      supplierMap.set(group.supplierId, group.supplierName);
    }
    for (const item of group.items) {
      if (isScheduledItem(item)) continue;
      if (item.supplier_id) {
        supplierMap.set(item.supplier_id, item.supplier_name ?? group.supplierName);
      }
      if (item.sales_person_id && item.sales_person_name) {
        salesMap.set(item.sales_person_id, item.sales_person_name);
      }
    }
  }

  const suppliers = Array.from(supplierMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const salesPeople = Array.from(salesMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return { suppliers, salesPeople };
}

export type TeethFilterOptions = ReturnType<typeof extractTeethFilterOptions>;

/** Scala opcje selectów z wielu źródeł (kolejka + historia). */
export function mergeTeethFilterOptions(
  ...optionSets: TeethFilterOptions[]
): TeethFilterOptions {
  const supplierMap = new Map<string, string>();
  const salesMap = new Map<string, string>();

  for (const set of optionSets) {
    for (const s of set.suppliers) supplierMap.set(s.id, s.name);
    for (const sp of set.salesPeople) salesMap.set(sp.id, sp.name);
  }

  const suppliers = Array.from(supplierMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  const salesPeople = Array.from(salesMap.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pl"));

  return { suppliers, salesPeople };
}

function normalizeTeethQueueGroup(entry: unknown): TeethQueueGroup | null {
  if (!entry || typeof entry !== "object") return null;
  const candidate = entry as TeethQueueGroup;
  if (Array.isArray(candidate.items)) return candidate;
  return null;
}

/** Scala grupy z wielu źródeł (kolejka + historia). */
export function mergeTeethFilterOptionGroups(
  ...groupLists: Array<TeethQueueGroup[] | null | undefined>
): TeethQueueGroup[] {
  const map = new Map<string, TeethQueueGroup>();
  for (const list of groupLists) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const group = normalizeTeethQueueGroup(raw);
      if (!group) continue;
      const key = group.supplierId ?? "__no_supplier";
      const existing = map.get(key);
      if (existing) {
        existing.items.push(...group.items);
      } else {
        map.set(key, { ...group, items: [...group.items] });
      }
    }
  }
  return Array.from(map.values());
}

function matchesTeethItemFilters(
  item: TeethQueueItem,
  filters: TeethPanelFilters,
  ctx?: TeethPanelReadinessContext,
): boolean {
  if (filters.salesPersonId && item.sales_person_id !== filters.salesPersonId) {
    return false;
  }
  if (filters.missingSpecOnly && orderHasTeethSpec(item, ctx)) {
    return false;
  }
  if (filters.verificationOnly && item.status !== "Weryfikacja") {
    return false;
  }
  return true;
}

/** Filtruje grupy kolejki — pozycje z harmonogramu zostają gdy grupa ma pasujące prośby. */
export function filterTeethQueueGroups(
  groups: TeethQueueGroup[],
  filters: TeethPanelFilters,
  ctx?: TeethPanelReadinessContext,
): TeethQueueGroup[] {
  return groups
    .filter((group) => !filters.supplierId || group.supplierId === filters.supplierId)
    .map((group) => {
      const scheduled = group.items.filter((item) => isScheduledItem(item));
      const orders = group.items.filter(
        (item): item is TeethQueueItem => !isScheduledItem(item)
      );
      const filteredOrders = orders.filter((item) =>
        matchesTeethItemFilters(item, filters, ctx),
      );
      if (filteredOrders.length === 0 && scheduled.length === 0) return null;
      const items = [...filteredOrders, ...scheduled];
      return {
        ...group,
        items,
        scheduledOnly: filteredOrders.length === 0 && scheduled.length > 0,
      };
    })
    .filter((group): group is TeethQueueGroup => group != null);
}

/** Filtruje grupy historii (bez pozycji harmonogramu). */
export function filterTeethHistoryGroups(
  groups: TeethQueueGroup[],
  filters: TeethPanelFilters,
  ctx?: TeethPanelReadinessContext,
): TeethQueueGroup[] {
  const result: TeethQueueGroup[] = [];
  for (const group of groups) {
    if (filters.supplierId && group.supplierId !== filters.supplierId) continue;
    const orders = group.items.filter(
      (item): item is TeethQueueItem => !isScheduledItem(item)
    );
    const filteredOrders = orders.filter((item) =>
      matchesTeethItemFilters(item, filters, ctx),
    );
    if (filteredOrders.length === 0) continue;
    result.push({ ...group, items: filteredOrders, scheduledOnly: false });
  }
  return result;
}

/** Statystyki kolejki per dostawca — do zakładki harmonogram. */
export function teethQueueStatsBySupplier(
  groups: TeethQueueGroup[],
  ctx?: TeethPanelReadinessContext,
): Map<string, { pendingCount: number; missingSpecCount: number }> {
  const map = new Map<string, { pendingCount: number; missingSpecCount: number }>();
  for (const group of groups) {
    if (!group.supplierId) continue;
    let pendingCount = 0;
    let missingSpecCount = 0;
    for (const item of group.items) {
      if (isScheduledItem(item)) continue;
      pendingCount++;
      if (!orderHasTeethSpec(item, ctx)) missingSpecCount++;
    }
    if (pendingCount > 0) {
      map.set(group.supplierId, { pendingCount, missingSpecCount });
    }
  }
  return map;
}
