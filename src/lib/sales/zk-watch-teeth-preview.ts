import type { IndividualOrderTeethDetail } from "@/types/database";
import type { ZkTeethOrder } from "@/lib/sales/zk-watch-order-link";

export type ZkTeethPreviewRow = {
  orderId: string;
  position: number;
  color: string;
  mould: string | null;
  size: string | null;
  jaw: "upper" | "lower" | null;
  kind: "anterior" | "posterior" | null;
  orderedAt: string | null;
  teethDeliveryDate: string | null;
  orderStatus: string;
  salesAcknowledgedAt: string | null;
  statusLabel: string;
  statusTone: "pending" | "ordered" | "delivered" | "acknowledged";
};

export type ZkTeethPreviewTone = ZkTeethPreviewRow["statusTone"];

export const ZK_TEETH_TONE_BADGE_CLASS: Record<ZkTeethPreviewTone, string> = {
  pending: "bg-amber-100 text-amber-950 ring-1 ring-amber-200/80",
  ordered: "bg-indigo-100 text-indigo-900 ring-1 ring-indigo-200/70",
  delivered: "bg-violet-100 text-violet-900 ring-1 ring-violet-200/70",
  acknowledged: "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/70",
};

function resolveTeethStatus(
  orderedAt: string | null,
  orderStatus: string,
  salesAcknowledgedAt: string | null,
): { label: string; tone: ZkTeethPreviewTone } {
  if (orderStatus === "Anulowane")
    return { label: "Anulowane", tone: "pending" };
  if (!orderedAt) return { label: "Czeka na zamówienie", tone: "pending" };
  if (orderStatus !== "Zrealizowane")
    return { label: "Zamówione u dostawcy", tone: "ordered" };
  if (!salesAcknowledgedAt)
    return { label: "Przyjęte — czeka na odbiór", tone: "delivered" };
  return { label: "Odebrane", tone: "acknowledged" };
}

export function buildZkTeethPreviewRows(
  teethOrders: ZkTeethOrder[],
  teethDetailsMap: Map<string, IndividualOrderTeethDetail[]>
): ZkTeethPreviewRow[] {
  const rows: ZkTeethPreviewRow[] = [];

  for (const order of teethOrders) {
    const details = teethDetailsMap.get(order.id) ?? [];

    if (details.length === 0) {
      const { label, tone } = resolveTeethStatus(
        order.teeth_ordered_at ?? order.ordered_at ?? null,
        order.status,
        order.sales_acknowledged_at,
      );
      rows.push({
        orderId: order.id,
        position: 0,
        color: "",
        mould: null,
        size: null,
        jaw: null,
        kind: null,
        orderedAt: order.teeth_ordered_at ?? order.ordered_at ?? null,
        teethDeliveryDate: order.teeth_delivery_date ?? null,
        orderStatus: order.status,
        salesAcknowledgedAt: order.sales_acknowledged_at,
        statusLabel: label,
        statusTone: tone,
      });
      continue;
    }

    for (const detail of details) {
      const { label, tone } = resolveTeethStatus(
        detail.ordered_at ?? order.teeth_ordered_at ?? order.ordered_at ?? null,
        order.status,
        order.sales_acknowledged_at,
      );
      rows.push({
        orderId: order.id,
        position: detail.position,
        color: detail.color,
        mould: detail.mould,
        size: detail.size,
        jaw: detail.jaw,
        kind: detail.kind,
        orderedAt:
          detail.ordered_at ?? order.teeth_ordered_at ?? order.ordered_at ?? null,
        teethDeliveryDate: order.teeth_delivery_date ?? null,
        orderStatus: order.status,
        salesAcknowledgedAt: order.sales_acknowledged_at,
        statusLabel: label,
        statusTone: tone,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId);
    return a.position - b.position;
  });

  return rows;
}
