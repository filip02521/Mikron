import { formatPlDate } from "@/lib/display-labels";
import { isInformacjaRequest } from "@/lib/orders/individual";
import {
  effectiveSalesCancelPhase,
  effectiveSalesCancelledQuantity,
  salesCancelArchiveDetail,
} from "@/lib/orders/sales-cancel";
import {
  isProcurementInitiatedCancel,
  procurementInitiatedCancelStatusCopy,
} from "@/lib/orders/procurement-cancel-note";
import { parseOrderQuantity } from "@/lib/orders/individual";
import {
  presentMyOrderGroup,
  type MyOrderRow,
} from "@/lib/orders/my-order-presenter";
import { groupOrdersForMyView } from "@/lib/orders/my-order-groups";
import { filterIndividualOrdersForSalesMyOrders } from "@/lib/orders/informacja-stock-out-reorder";
import {
  warsawDateKeyDaysAgo,
  warsawDateKeyFromIso,
} from "@/lib/time/warsaw";
import type { DeliveryStats, IndividualOrder } from "@/types/database";

/** Domyślny widok archiwum — ostatnie N dni kalendarzowych (Warszawa). */
export const ARCHIVE_RECENT_DAYS = 7;

/** Po „Pokaż więcej” — starsze wpisy do N dni wstecz. */
export const ARCHIVE_EXPANDED_DAYS = 90;

/** Maks. liczba kart po rozwinięciu „więcej”. */
export const ARCHIVE_EXPANDED_GROUP_LIMIT = 50;

export type PresentArchivedOptions = {
  /** YYYY-MM-DD (Warszawa) — tylko potwierdzenia od tej daty włącznie. */
  acknowledgedSince?: string;
  groupLimit?: number;
};

function archiveActivityAt(order: IndividualOrder): string | null {
  return (
    order.sales_acknowledged_at ??
    order.sales_cancelled_at ??
    (order.status === "Anulowane" ? order.action_at : null)
  );
}

function filterAcknowledgedSince(
  orders: IndividualOrder[],
  acknowledgedSince?: string
): IndividualOrder[] {
  if (!acknowledgedSince) return orders;
  return orders.filter((o) => {
    const at = archiveActivityAt(o);
    if (!at) return false;
    return warsawDateKeyFromIso(at) >= acknowledgedSince;
  });
}

function archivedStatusCopy(orders: IndividualOrder[]): {
  statusTitle: string;
  statusDetail: string | null;
} {
  const activityAt = orders
    .map(archiveActivityAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .reverse()[0];
  const activityLabel = activityAt ? formatPlDate(activityAt.slice(0, 10)) : null;

  const salesCancelled = orders.filter((o) => o.sales_cancelled_at);
  if (salesCancelled.length > 0) {
    const phase =
      effectiveSalesCancelPhase(salesCancelled[0]!) ?? "before_order";
    const rep = salesCancelled[0]!;
    const ordered = parseOrderQuantity(rep.quantity);
    const cancelled = effectiveSalesCancelledQuantity(rep);
    const partial =
      ordered != null && cancelled > 0 && cancelled < ordered
        ? { cancelledQty: cancelled, orderedQty: ordered }
        : null;
    return salesCancelArchiveDetail(phase, activityLabel, partial);
  }

  const when = activityLabel ? `Potwierdzono ${activityLabel}` : null;

  const procurementCancelled = orders.filter((o) => isProcurementInitiatedCancel(o));
  if (procurementCancelled.length > 0) {
    const kind = isInformacjaRequest(procurementCancelled[0]!) ? "informacja" : "zamowienie";
    const copy = procurementInitiatedCancelStatusCopy(kind);
    return {
      statusTitle: copy.statusTitle,
      statusDetail: when ?? copy.statusDetail,
    };
  }

  if (orders.some((o) => isInformacjaRequest(o))) {
    return {
      statusTitle: "Powiadomienie potwierdzone",
      statusDetail: when ?? "Prośba informacyjna zamknięta",
    };
  }

  if (orders.some((o) => o.status === "Zrealizowane")) {
    return {
      statusTitle: "Odebrane z magazynu",
      statusDetail: when ?? "Odbiór potwierdzony",
    };
  }

  return {
    statusTitle: "Zakończone",
    statusDetail: when,
  };
}

function decorateArchivedRow(
  row: MyOrderRow,
  orders: IndividualOrder[]
): MyOrderRow {
  const { statusTitle, statusDetail } = archivedStatusCopy(orders);
  return {
    ...row,
    statusTitle,
    statusDetail,
    badgeVariant: "default",
    acknowledgeMode: "none",
    pickupPendingCount: 0,
    pickupPendingIds: [],
    headline: statusTitle,
    headlineTone: "neutral",
    subline: statusDetail,
    sortPriority: 100,
  };
}

/** Ostatnio potwierdzone przez handlowca (read-only). */
export function presentArchivedMyOrders(
  orders: IndividualOrder[],
  statsRows: DeliveryStats[],
  options: PresentArchivedOptions = {}
): MyOrderRow[] {
  const { acknowledgedSince, groupLimit } = options;
  const statsBySupplier = Object.fromEntries(
    statsRows.map((s) => [s.supplier_id, s])
  );

  const acknowledged = filterAcknowledgedSince(
    filterIndividualOrdersForSalesMyOrders(orders),
    acknowledgedSince
  ).sort(
    (a, b) =>
      (archiveActivityAt(b) ?? "").localeCompare(archiveActivityAt(a) ?? "")
  );

  const rows: MyOrderRow[] = [];
  const cap = groupLimit ?? Number.POSITIVE_INFINITY;

  for (const group of groupOrdersForMyView(acknowledged)) {
    if (rows.length >= cap) break;
    const row = presentMyOrderGroup(group, statsBySupplier);
    rows.push(decorateArchivedRow(row, group));
  }

  return rows;
}

export function archiveAcknowledgedSinceRecent(): string {
  return warsawDateKeyDaysAgo(ARCHIVE_RECENT_DAYS);
}

export function archiveAcknowledgedSinceExpanded(): string {
  return warsawDateKeyDaysAgo(ARCHIVE_EXPANDED_DAYS);
}
