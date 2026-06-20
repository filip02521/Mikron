import { isInformacjaRequest } from "@/lib/orders/individual";
import { submittedAt } from "@/lib/orders/order-timing";
import type { IndividualOrder, IndividualOrderStatus } from "@/types/database";

const OPEN_STATUSES: IndividualOrderStatus[] = ["Nowe", "Weryfikacja"];

function isOpenStatus(status: IndividualOrderStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

/** Zamówione u dostawcy + częściowa dostawa — jedna karta (wiele linii, różne statusy DB). */
function supplierDeliveryGroupStatus(status: IndividualOrderStatus): IndividualOrderStatus {
  if (status === "Czesciowo_zrealizowane") return "Zamowione";
  return status;
}

/**
 * Klucz grupy w „Moje zamówienia”.
 *
 * Domyślnie: ten sam dostawca + ten sam status = jedna karta (wiele produktów w `lines`).
 * `Czesciowo_zrealizowane` i `Zamowione` u tego dostawcy — jedna karta (reszta u dostawcy).
 * Wyjątek: otwarte zgłoszenie z jednego formularza (`submission_group_id`) — jedna grupa
 * nawet przy mieszanych statusach w teorii; w praktyce formularz ma jeden status.
 */
export function myOrderGroupKey(order: IndividualOrder): string {
  const kind = isInformacjaRequest(order) ? "inf" : "zam";
  const supplier = order.supplier_id ?? "none";
  const person = order.sales_person_id;
  const status = supplierDeliveryGroupStatus(order.status);

  if (order.submission_group_id && isOpenStatus(order.status)) {
    return `${kind}-sub|${order.submission_group_id}|${status}`;
  }

  return `${kind}|${supplier}|${person}|${status}`;
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
