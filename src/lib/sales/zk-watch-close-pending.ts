import { isInformacjaRequest } from "@/lib/orders/individual";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import { isSalesCancelNoticePending } from "@/lib/orders/sales-cancel";
import {
  isAwaitingInformacjaAck,
  isAwaitingSalesPickup,
} from "@/lib/orders/sales-pickup";
import { isZdFulfillmentDeadlineChangeVisible } from "@/lib/orders/zd-fulfillment-deadline-change";
import type { IndividualOrder } from "@/types/database";
import type { SalesZkWatch } from "@/types/database";
import { buildZkWatchLineViews } from "./zk-watch-lines";
import {
  isOrderRelevantToZkWatch,
  productMatchesZkLine,
  type ZkLinkableOrder,
} from "./zk-watch-order-link";

export type ZkWatchPendingAckKind =
  | "pickup"
  | "availability"
  | "cancel_notice"
  | "cancelled"
  | "zd_deadline";

export type ZkWatchPendingAckItem = {
  orderId: string;
  kind: ZkWatchPendingAckKind;
  productLabel: string;
  symbol: string | null;
  quantityLabel: string;
  statusLabel: string;
  requestKind: "zamowienie" | "informacja";
};

const STATUS_LABELS: Record<ZkWatchPendingAckKind, string> = {
  pickup: "Gotowe do odbioru z magazynu",
  availability: "Informacja — towar na magazynie",
  cancel_notice: "Rezygnacja do potwierdzenia",
  cancelled: "Anulowane — do ukrycia z listy",
  zd_deadline: "Zmiana terminu dostawy",
};

const KIND_BADGE_LABELS: Record<ZkWatchPendingAckKind, string> = {
  pickup: "Odbiór",
  availability: "Informacja",
  cancel_notice: "Rezygnacja",
  cancelled: "Anulowanie",
  zd_deadline: "Termin ZD",
};

export function zkWatchPendingAckKindBadgeVariant(
  kind: ZkWatchPendingAckKind
): "success" | "info" | "warning" | "danger" | "default" {
  switch (kind) {
    case "pickup":
      return "success";
    case "availability":
      return "info";
    case "cancel_notice":
      return "warning";
    case "cancelled":
      return "danger";
    case "zd_deadline":
      return "warning";
    default:
      return "default";
  }
}

export function zkWatchPendingAckKindBadgeLabel(kind: ZkWatchPendingAckKind): string {
  return KIND_BADGE_LABELS[kind];
}

function formatOrderProductLabel(order: ZkLinkableOrder): string {
  return (
    order.products?.trim() ||
    order.symbol?.trim() ||
    order.mikran_code?.trim() ||
    "Produkt"
  );
}

function formatOrderQuantityLabel(order: ZkLinkableOrder): string {
  const qty = order.quantity?.trim();
  if (!qty || qty === "-") return "—";
  return qty.includes("szt") ? qty : `${qty} szt.`;
}

function asIndividualOrder(order: ZkLinkableOrder): IndividualOrder {
  return order as unknown as IndividualOrder;
}

/** Czy niepotwierdzona prośba dotyczy tego ZK (nie tylko tego samego klienta). */
export function isOrderPendingAckForZkClose(
  order: ZkLinkableOrder,
  watch: SalesZkWatch
): boolean {
  if (!isOrderRelevantToZkWatch(order, watch)) return false;
  if (orderExplicitlyLinkedToZkWatch(order, watch)) return true;

  const lineViews = buildZkWatchLineViews(watch);
  return lineViews.some(
    (line) => line.key !== "summary" && productMatchesZkLine(order, line)
  );
}

/** Klasyfikuje oczekujące potwierdzenia dla pojedynczej prośby (jak w /moje). */
export function classifyZkWatchPendingAckKinds(
  order: ZkLinkableOrder
): ZkWatchPendingAckKind[] {
  const kinds: ZkWatchPendingAckKind[] = [];
  const row = asIndividualOrder(order);

  if (isSalesCancelNoticePending(row)) {
    kinds.push("cancel_notice");
  } else if (order.status === "Anulowane" && !order.sales_acknowledged_at) {
    kinds.push("cancelled");
  } else if (isAwaitingSalesPickup(row)) {
    kinds.push("pickup");
  } else if (isAwaitingInformacjaAck(row)) {
    kinds.push("availability");
  }

  if (isZdFulfillmentDeadlineChangeVisible(row)) {
    kinds.push("zd_deadline");
  }

  return kinds;
}

export function isZkWatchPendingAckOrder(order: ZkLinkableOrder): boolean {
  return classifyZkWatchPendingAckKinds(order).length > 0;
}

function pendingAckSortRank(kind: ZkWatchPendingAckKind): number {
  switch (kind) {
    case "pickup":
      return 0;
    case "availability":
      return 1;
    case "zd_deadline":
      return 2;
    case "cancel_notice":
      return 3;
    case "cancelled":
      return 4;
    default:
      return 5;
  }
}

/** Prośby powiązane z ZK, które wymagają potwierdzenia w /moje. */
export function collectZkWatchPendingAckItems(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): ZkWatchPendingAckItem[] {
  const items: ZkWatchPendingAckItem[] = [];

  for (const order of orders) {
    if (!isOrderPendingAckForZkClose(order, watch)) continue;

    const kinds = classifyZkWatchPendingAckKinds(order);
    if (!kinds.length) continue;

    const productLabel = formatOrderProductLabel(order);
    const symbol = order.symbol?.trim() || null;
    const quantityLabel = formatOrderQuantityLabel(order);
    const requestKind = isInformacjaRequest(asIndividualOrder(order))
      ? "informacja"
      : "zamowienie";

    for (const kind of kinds) {
      items.push({
        orderId: order.id,
        kind,
        productLabel,
        symbol,
        quantityLabel,
        statusLabel: STATUS_LABELS[kind],
        requestKind,
      });
    }
  }

  return items.sort((a, b) => {
    const rank = pendingAckSortRank(a.kind) - pendingAckSortRank(b.kind);
    if (rank !== 0) return rank;
    return a.productLabel.localeCompare(b.productLabel, "pl");
  });
}

export function collectZkWatchPendingAckOrderIds(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[]
): string[] {
  return [
    ...new Set(collectZkWatchPendingAckItems(watch, orders).map((item) => item.orderId)),
  ];
}

export function collectZkWatchPendingAckOrderIdsFromItems(
  items: ZkWatchPendingAckItem[]
): string[] {
  return [...new Set(items.map((item) => item.orderId))];
}

export function zkWatchPendingAckItemsIncludePickup(
  items: ZkWatchPendingAckItem[]
): boolean {
  return items.some((item) => item.kind === "pickup");
}

export function groupZkWatchPendingAckOrderIdsByKind(
  items: ZkWatchPendingAckItem[]
): Record<ZkWatchPendingAckKind, string[]> {
  const grouped: Record<ZkWatchPendingAckKind, string[]> = {
    pickup: [],
    availability: [],
    cancel_notice: [],
    cancelled: [],
    zd_deadline: [],
  };

  for (const item of items) {
    if (!grouped[item.kind].includes(item.orderId)) {
      grouped[item.kind].push(item.orderId);
    }
  }

  return grouped;
}
