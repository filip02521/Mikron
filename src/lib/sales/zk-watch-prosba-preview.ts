import { parseDateOnly } from "@/lib/orders/dates";
import {
  buildDeliveryDateMetaDisplay,
  type DeliveryDateMetaDisplay,
} from "@/lib/orders/delivery-date-meta-label";
import { formatOrderQuantityLabel, getDeliveryProgress } from "@/lib/orders/individual";
import { MY_ORDER_HISTORY_ESTIMATE_CAPTION } from "@/lib/orders/my-order-history-estimate-copy";
import { myOrderFriendlyStatusLabel } from "@/lib/orders/my-order-friendly-status";
import { orderPlacementAt } from "@/lib/orders/order-timing";
import { zdFulfillmentCollapsedCaption } from "@/lib/orders/my-order-zd-fulfillment-display";
import {
  buildPlaceholderZdDeliveryDateMetaDisplay,
  buildZdDeliveryDateMetaDisplay,
  isPlaceholderZdFulfillmentDeadline,
  ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL,
  ZD_FULFILLMENT_PLACEHOLDER_ZK_META,
} from "@/lib/orders/zd-fulfillment-placeholder-deadline";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import {
  isOpenProsbaOrder,
  isOrderRelevantToZkWatch,
  productMatchesZkLine,
  type ZkLinkableOrder,
  type ZkWatchOrderHints,
} from "@/lib/sales/zk-watch-order-link";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { IndividualRequestKind } from "@/types/database";
import type { SalesZkWatch } from "@/types/database";

type DeliveryTone = "default" | "zd" | "available" | "overdue" | "pending";

export type ZkProsbaPreviewStatusBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "purple"
  | "danger";

export function resolveZkProsbaPreviewStatusBadgeVariant(
  status: string
): ZkProsbaPreviewStatusBadgeVariant {
  switch (status) {
    case "Zrealizowane":
      return "success";
    case "Czesciowo_zrealizowane":
      return "warning";
    case "Weryfikacja":
      return "warning";
    case "Anulowane":
      return "default";
    case "Nowe":
    case "Zamowione":
    default:
      return "info";
  }
}

export type ZkWatchProsbaPreviewEntry = {
  order: ZkLinkableOrder;
  productLabel: string;
  quantityLabel: string;
  progressLabel: string | null;
  deliveryCaption: string;
  deliveryTone: DeliveryTone;
  deliveryDisplay: DeliveryDateMetaDisplay | null;
  deliveryEmptyLabel: string | null;
  statusLabel: string;
  statusBadgeVariant: ZkProsbaPreviewStatusBadgeVariant;
  requestKind: IndividualRequestKind | null;
  explicitlyLinked: boolean;
  isOpen: boolean;
};

const LINKABLE_STATUS_LABEL: Record<string, string> = {
  Nowe: "Nowa",
  Weryfikacja: "W weryfikacji",
  Zamowione: "Zamówione",
  Czesciowo_zrealizowane: "Częściowo zrealizowane",
  Zrealizowane: "Zrealizowane",
  Anulowane: "Anulowana",
};

export function formatZkLinkableOrderStatus(status: string): string {
  const mapped = LINKABLE_STATUS_LABEL[status];
  if (mapped) return myOrderFriendlyStatusLabel(mapped);
  return myOrderFriendlyStatusLabel(status);
}

export function formatZkProsbaProductLabel(
  order: Pick<ZkLinkableOrder, "products" | "symbol" | "mikran_code">
): string {
  const product = order.products?.trim();
  const sym = order.symbol?.trim() || order.mikran_code?.trim();
  if (product && sym) return `${product} (${sym})`;
  return product || sym || "Pozycja bez opisu";
}

/** Meta wiersza prośby w modalu ZK — ilość, postęp, termin. */
export function formatZkProsbaPreviewMetaLine(
  entry: Pick<
    ZkWatchProsbaPreviewEntry,
    "quantityLabel" | "progressLabel" | "deliveryCaption" | "deliveryDisplay" | "deliveryEmptyLabel"
  >,
  options?: { compact?: boolean }
): string {
  const compact = options?.compact ?? true;
  const parts = [`Liczba: ${entry.quantityLabel}`];
  if (entry.progressLabel) parts.push(entry.progressLabel);

  if (entry.deliveryDisplay) {
    if (
      compact &&
      entry.deliveryDisplay.primaryLabel === ZD_FULFILLMENT_PLACEHOLDER_PRIMARY_LABEL
    ) {
      parts.push(ZD_FULFILLMENT_PLACEHOLDER_ZK_META);
    } else if (compact) {
      parts.push(`${entry.deliveryCaption}: ${entry.deliveryDisplay.primaryLabel}`);
    } else {
      const dateLabel = entry.deliveryDisplay.detailLabel
        ? `${entry.deliveryDisplay.primaryLabel} — ${entry.deliveryDisplay.detailLabel}`
        : entry.deliveryDisplay.primaryLabel;
      parts.push(`${entry.deliveryCaption}: ${dateLabel}`);
    }
  } else if (entry.deliveryEmptyLabel) {
    parts.push(entry.deliveryEmptyLabel);
  }

  return parts.join(" · ");
}

/** Pełny opis meta prośby — tooltip przy obciętym wierszu. */
export function formatZkProsbaPreviewMetaTooltip(
  entry: Pick<
    ZkWatchProsbaPreviewEntry,
    "quantityLabel" | "progressLabel" | "deliveryCaption" | "deliveryDisplay" | "deliveryEmptyLabel"
  >
): string {
  return formatZkProsbaPreviewMetaLine(entry, { compact: false });
}

export function resolveZkProsbaPreviewDelivery(
  order: Pick<
    ZkLinkableOrder,
    | "delivery_at"
    | "zd_fulfillment_deadline"
    | "zd_fulfillment_deadline_changed_at"
    | "ordered_at"
    | "action_at"
    | "status"
    | "request_kind"
  >
): Pick<
  ZkWatchProsbaPreviewEntry,
  "deliveryCaption" | "deliveryTone" | "deliveryDisplay" | "deliveryEmptyLabel"
> {
  if (order.request_kind === "informacja") {
    return {
      deliveryCaption: "Prośba informacyjna",
      deliveryTone: "pending",
      deliveryDisplay: null,
      deliveryEmptyLabel: "Termin dostawy nie dotyczy — czekamy na info z magazynu.",
    };
  }

  if (order.status === "Zrealizowane") {
    return {
      deliveryCaption: "",
      deliveryTone: "default",
      deliveryDisplay: null,
      deliveryEmptyLabel: null,
    };
  }

  const zdDeadline = order.zd_fulfillment_deadline?.trim();
  if (zdDeadline) {
    const parsed = parseDateOnly(zdDeadline);
    if (parsed) {
      const placementAt = orderPlacementAt(order);
      const placeholder = isPlaceholderZdFulfillmentDeadline({
        deadline: zdDeadline,
        placementAt,
        deadlineChangedAt: order.zd_fulfillment_deadline_changed_at,
      });
      const display = placeholder
        ? buildPlaceholderZdDeliveryDateMetaDisplay()
        : buildZdDeliveryDateMetaDisplay(parsed, {
            placementAt,
            deadlineChangedAt: order.zd_fulfillment_deadline_changed_at,
          });
      return {
        deliveryCaption: zdFulfillmentCollapsedCaption(1, { overdue: display.overdue }),
        deliveryTone: placeholder ? "pending" : display.overdue ? "overdue" : "zd",
        deliveryDisplay: display,
        deliveryEmptyLabel: null,
      };
    }
  }

  const deliveryAt = order.delivery_at?.trim();
  if (deliveryAt) {
    const parsed = parseDateOnly(deliveryAt.slice(0, 10));
    if (parsed) {
      const display = buildDeliveryDateMetaDisplay(parsed);
      return {
        deliveryCaption: MY_ORDER_HISTORY_ESTIMATE_CAPTION,
        deliveryTone: display.overdue ? "overdue" : "default",
        deliveryDisplay: display,
        deliveryEmptyLabel: null,
      };
    }
  }

  return {
    deliveryCaption: "Termin dostawy",
    deliveryTone: "pending",
    deliveryDisplay: null,
    deliveryEmptyLabel: "Jeszcze nie ustalono — dział dostaw poda datę w kolejnych krokach.",
  };
}

function buildPreviewEntry(
  watch: SalesZkWatch,
  order: ZkLinkableOrder,
  openIds: Set<string>
): ZkWatchProsbaPreviewEntry {
  const progress = getDeliveryProgress(order.quantity, order.delivered_quantity);
  const progressLabel =
    order.request_kind === "informacja"
      ? null
      : progress.hasNumericQty
        ? progress.fractionLabel
        : null;
  const delivery = resolveZkProsbaPreviewDelivery(order);

  return {
    order,
    productLabel: formatZkProsbaProductLabel(order),
    quantityLabel: formatOrderQuantityLabel(order.quantity, order.request_kind),
    progressLabel,
    ...delivery,
    statusLabel: formatZkLinkableOrderStatus(order.status),
    statusBadgeVariant: resolveZkProsbaPreviewStatusBadgeVariant(order.status),
    requestKind: order.request_kind ?? "zamowienie",
    explicitlyLinked: orderExplicitlyLinkedToZkWatch(order, watch),
    isOpen: openIds.has(order.id),
  };
}

/** Aktywne prośby powiązane z ZK — do listy i podglądu w modalu. */
export function buildZkWatchOpenProsbaPreviewEntries(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[],
  hints?: ZkWatchOrderHints
): ZkWatchProsbaPreviewEntry[] {
  const openIds = new Set(hints?.matchingOpenRequestIds ?? []);
  if (!openIds.size) return [];

  return orders
    .filter((order) => openIds.has(order.id))
    .map((order) => buildPreviewEntry(watch, order, openIds));
}

/** Wszystkie powiązane prośby (otwarte na górze) — do pełnego podglądu. */
export function buildZkWatchProsbaPreviewEntries(
  watch: SalesZkWatch,
  orders: ZkLinkableOrder[],
  hints?: ZkWatchOrderHints
): ZkWatchProsbaPreviewEntry[] {
  const openIds = new Set(hints?.matchingOpenRequestIds ?? []);
  const lineViews = buildZkWatchLineViews(watch).filter((line) => line.key !== "summary");

  const relevant = orders.filter((order) => {
    if (!isOrderRelevantToZkWatch(order, watch)) return false;
    if (orderExplicitlyLinkedToZkWatch(order, watch)) return true;
    if (openIds.has(order.id)) return true;
    const matchesLine = lineViews.some((line) => productMatchesZkLine(order, line));
    if (!matchesLine) return false;
    if (isOpenProsbaOrder(order)) return false;
    return true;
  });

  const unique = new Map<string, ZkLinkableOrder>();
  for (const order of relevant) {
    unique.set(order.id, order);
  }

  return [...unique.values()]
    .map((order) => buildPreviewEntry(watch, order, openIds))
    .sort((a, b) => Number(b.isOpen) - Number(a.isOpen));
}
