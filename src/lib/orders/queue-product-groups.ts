import type { IndividualOrder } from "@/types/database";
import {
  groupOrdersBySupplier,
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
} from "@/lib/orders/queue-supplier-groups";

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ten sam towar w kolejce informacji = ten sam dostawca + symbol (jeśli jest) lub nazwa produktu.
 */
export function informacjaProductKey(order: IndividualOrder): string {
  const supplierId = order.supplier_id ?? "none";
  const symbol = order.symbol?.trim();
  const hasSymbol = Boolean(symbol && symbol !== "-");
  const symbolToken = hasSymbol ? normalizeToken(symbol!) : "";
  const productToken = normalizeToken(order.products || "");
  return `${supplierId}|${symbolToken || productToken}`;
}

export function informacjaProductTitle(order: IndividualOrder): string {
  const symbol = order.symbol?.trim();
  if (symbol && symbol !== "-") {
    return `${order.products} (${symbol})`;
  }
  return order.products;
}

/** Id pozycji w bloku tego samego towaru (lista posortowana po produkcie). */
export function orderIdsInProductGroup(
  orders: IndividualOrder[],
  startIndex: number
): string[] {
  const key = informacjaProductKey(orders[startIndex]!);
  const ids: string[] = [];
  for (let i = startIndex; i < orders.length; i++) {
    if (informacjaProductKey(orders[i]!) !== key) break;
    ids.push(orders[i]!.id);
  }
  return ids;
}

export function productGroupIndexByOrderId(
  orders: IndividualOrder[]
): Map<string, number> {
  const map = new Map<string, number>();
  let groupIndex = -1;
  let lastKey = "";
  for (const o of orders) {
    const key = informacjaProductKey(o);
    if (key !== lastKey) {
      groupIndex++;
      lastKey = key;
    }
    map.set(o.id, groupIndex);
  }
  return map;
}

/** Kolejka informacji: ten sam towar razem, potem handlowiec, potem data zgłoszenia. */
export function sortInformacjaQueueByProduct(
  orders: IndividualOrder[]
): IndividualOrder[] {
  return [...orders].sort((a, b) => {
    const byProduct = informacjaProductKey(a).localeCompare(informacjaProductKey(b));
    if (byProduct !== 0) return byProduct;

    const pa = a.sales_person?.name?.trim() ?? "";
    const pb = b.sales_person?.name?.trim() ?? "";
    const byPerson = pa.localeCompare(pb, "pl", { sensitivity: "base" });
    if (byPerson !== 0) return byPerson;

    return new Date(a.action_at).getTime() - new Date(b.action_at).getTime();
  });
}

/** Jak kolejka dostaw: grupy dostawców, w grupie ten sam towar razem. */
export function sortInformacjaQueueForDisplay(
  orders: IndividualOrder[]
): IndividualOrder[] {
  return groupOrdersBySupplier(orders).flatMap((g) =>
    sortInformacjaQueueByProduct(g.orders)
  );
}

export function queueInformacjaProductRowClass(
  groupIndex: number,
  options?: { isFirstInProductGroup?: boolean }
): string {
  return queueSupplierRowClass(groupIndex, {
    variant: "informacja",
    isFirstInSupplierGroup: options?.isFirstInProductGroup,
  });
}

export function queueInformacjaProductLeadingCellClass(groupIndex: number): string {
  return queueSupplierLeadingCellClass(groupIndex, { variant: "informacja" });
}
