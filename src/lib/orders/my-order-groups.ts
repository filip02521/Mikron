import { isInformacjaRequest } from "@/lib/orders/individual";
import { orderPlacementAt, submittedAt } from "@/lib/orders/order-timing";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

const OPEN_STATUSES: IndividualOrderStatus[] = ["Nowe", "Weryfikacja"];
const PLACED_STATUSES: IndividualOrderStatus[] = [
  "Zamowione",
  "Czesciowo_zrealizowane",
  "Zrealizowane",
];

function isOpenStatus(status: IndividualOrderStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

function isPlacedStatus(status: IndividualOrderStatus): boolean {
  return PLACED_STATUSES.includes(status);
}

/**
 * Klucz grupy — pozycje z tym samym kluczem = jedna dostawa w „Moje zamówienia”.
 *
 * Priorytet:
 * 1. submission_group_id — całe zgłoszenie z formularza (np. 10 produktów naraz)
 * 2. placement_group_id — zamówione jednym kliknięciem w panelu
 * 3. Otwarte prośby: jeden koszyk na dostawcę + handlowca + status
 * 4. Zamówione: dokładny ordered_at (po batchu) lub minuta + typ
 */
export function myOrderGroupKey(order: IndividualOrder): string {
  if (isInformacjaRequest(order)) {
    if (order.submission_group_id && isOpenStatus(order.status)) {
      return `inf-sub|${order.submission_group_id}`;
    }
    return [
      "inf",
      order.supplier_id ?? "none",
      order.sales_person_id,
      order.status,
    ].join("|");
  }

  if (order.submission_group_id && isOpenStatus(order.status)) {
    return `sub|${order.submission_group_id}`;
  }

  if (order.placement_group_id && isPlacedStatus(order.status)) {
    return `place|${order.placement_group_id}`;
  }

  const placement = orderPlacementAt(order);
  if (placement && isPlacedStatus(order.status)) {
    return [
      "ord",
      order.supplier_id ?? "none",
      order.sales_person_id,
      order.status,
      order.order_type,
      placement,
    ].join("|");
  }

  if (isOpenStatus(order.status)) {
    return [
      "open",
      order.supplier_id ?? "none",
      order.sales_person_id,
      order.status,
    ].join("|");
  }

  const placementMinute = placement?.slice(0, 16) ?? `legacy|${submittedAt(order).slice(0, 10)}`;
  return [
    "zam",
    order.supplier_id ?? "none",
    order.sales_person_id,
    order.status,
    order.order_type,
    placementMinute,
  ].join("|");
}

export function groupOrdersForMyView(orders: IndividualOrder[]): IndividualOrder[][] {
  const byKey = new Map<string, IndividualOrder[]>();
  for (const order of orders) {
    const key = myOrderGroupKey(order);
    const list = byKey.get(key) ?? [];
    list.push(order);
    byKey.set(key, list);
  }

  const groups = [...byKey.values()];
  for (const g of groups) {
    g.sort((a, b) => {
      const t = submittedAt(b).localeCompare(submittedAt(a));
      if (t !== 0) return t;
      return a.products.localeCompare(b.products, "pl");
    });
  }

  groups.sort((a, b) => submittedAt(b[0]).localeCompare(submittedAt(a[0])));

  return groups;
}
