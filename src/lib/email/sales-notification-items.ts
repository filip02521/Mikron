import type { IndividualOrder } from "@/types/database";
import { parseOrderQuantity } from "@/lib/orders/individual";
import { normalizeSalesClientName } from "@/lib/orders/sales-client-label";
import { normalizeProcurementCancelNote } from "@/lib/orders/procurement-cancel-note";
import type {
  SalesDeliveryNotificationItem,
  SalesInformacjaNotificationItem,
  SalesProcurementCancelNotificationItem,
} from "@/lib/email/sales-notification-types";

type OrderForEmail = Pick<
  IndividualOrder,
  | "products"
  | "symbol"
  | "sales_client_name"
  | "quantity"
  | "delivered_quantity"
  | "status"
  | "procurement_cancel_note"
> & {
  supplier?: { name?: string } | null;
};

function supplierName(order: OrderForEmail): string {
  return order.supplier?.name?.trim() || "Dostawca";
}

function symbolOrNull(symbol: string): string | null {
  const s = symbol?.trim();
  if (!s || s === "-") return null;
  return s;
}

function clientOrNull(order: OrderForEmail): string | null {
  return normalizeSalesClientName(order.sales_client_name);
}

function parseDeliveredQty(value: string | undefined): number | null {
  if (!value || value === "-") return null;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function productsLabel(products: string): string {
  const t = products.trim();
  return t || "—";
}

/** Pozycja zamówienia po zapisie realizacji (pełna lub częściowa dostawa). */
export function buildDeliveryNotificationItem(
  order: OrderForEmail,
  opts?: { deliveredQuantity?: string }
): SalesDeliveryNotificationItem {
  const orderedQty = parseOrderQuantity(order.quantity);
  const deliveredRaw = opts?.deliveredQuantity ?? order.delivered_quantity;
  const deliveredQty = parseDeliveredQty(deliveredRaw);

  const deliveryKind: "complete" | "partial" =
    order.status === "Czesciowo_zrealizowane" ||
    (orderedQty != null &&
      deliveredQty != null &&
      deliveredQty > 0 &&
      deliveredQty < orderedQty)
      ? "partial"
      : "complete";

  return {
    kind: "delivery",
    supplierName: supplierName(order),
    products: productsLabel(order.products),
    symbol: symbolOrNull(order.symbol),
    clientName: clientOrNull(order),
    orderedQty,
    deliveredQty,
    deliveryKind,
  };
}

/** Pozycja informacyjna — towar jest na magazynie. */
export function buildInformacjaNotificationItem(
  order: OrderForEmail
): SalesInformacjaNotificationItem {
  return {
    kind: "informacja",
    supplierName: supplierName(order),
    products: productsLabel(order.products),
    symbol: symbolOrNull(order.symbol),
    clientName: clientOrNull(order),
  };
}

/** Anulowanie prośby przez dział dostaw — z opcjonalną wiadomością. */
export function buildProcurementCancelNotificationItem(
  order: OrderForEmail
): SalesProcurementCancelNotificationItem {
  return {
    kind: "procurement_cancel",
    supplierName: supplierName(order),
    products: productsLabel(order.products),
    symbol: symbolOrNull(order.symbol),
    clientName: clientOrNull(order),
    procurementCancelNote: normalizeProcurementCancelNote(order.procurement_cancel_note),
  };
}
