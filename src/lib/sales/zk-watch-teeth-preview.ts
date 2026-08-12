import type { IndividualOrderTeethDetail, SalesZkWatch } from "@/types/database";
import type { ZkTeethOrder } from "@/lib/sales/zk-watch-order-link";
import {
  isZkTeethDraftComplete,
  parseZkTeethDrafts,
} from "@/lib/sales/zk-watch-teeth-draft";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";

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
  statusTone: "pending" | "ordered" | "delivered" | "acknowledged" | "draft" | "draftReady";
  /** true = wiersz ze szkicu na ZK (jeszcze bez zamówienia). */
  fromDraft?: boolean;
};

export type ZkTeethPreviewTone = ZkTeethPreviewRow["statusTone"];

export const ZK_TEETH_TONE_BADGE_CLASS: Record<ZkTeethPreviewTone, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200/80",
  ordered: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200/70",
  delivered: "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/70",
  acknowledged: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200/70",
  draft: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-300/80",
  draftReady: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200/80",
};

function resolveTeethStatus(
  orderedAt: string | null,
  orderStatus: string,
  salesAcknowledgedAt: string | null,
): { label: string; tone: Exclude<ZkTeethPreviewTone, "draft" | "draftReady"> } {
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

/** Wiersze ze szkiców list zębów na ZK (przed prośbą). */
export function buildZkTeethDraftPreviewRows(
  watch: Pick<SalesZkWatch, "teeth_drafts" | "subiekt_snapshot" | "line_summary">
): ZkTeethPreviewRow[] {
  const drafts = parseZkTeethDrafts(watch.teeth_drafts);
  const views = buildZkWatchLineViews(watch as SalesZkWatch);
  const qtyByKey = new Map(views.map((v) => [v.key, v.quantity]));
  const rows: ZkTeethPreviewRow[] = [];

  for (const draft of Object.values(drafts)) {
    const qty = qtyByKey.get(draft.lineKey) ?? draft.expectedQuantity;
    const complete = isZkTeethDraftComplete(draft, qty);
    const statusLabel = complete ? "Lista gotowa" : "Szkic listy";
    const statusTone = complete ? ("draftReady" as const) : ("draft" as const);

    if (!draft.teethDetails.length) {
      rows.push({
        orderId: `draft:${draft.lineKey}`,
        position: 0,
        color: "",
        mould: null,
        size: null,
        jaw: null,
        kind: draft.teethKind,
        orderedAt: null,
        teethDeliveryDate: null,
        orderStatus: "",
        salesAcknowledgedAt: null,
        statusLabel,
        statusTone,
        fromDraft: true,
      });
      continue;
    }

    for (const detail of draft.teethDetails) {
      rows.push({
        orderId: `draft:${draft.lineKey}`,
        position: detail.position,
        color: detail.color,
        mould: detail.mould ?? null,
        size: detail.size ?? null,
        jaw: detail.jaw ?? null,
        kind: detail.kind ?? draft.teethKind,
        orderedAt: null,
        teethDeliveryDate: null,
        orderStatus: "",
        salesAcknowledgedAt: null,
        statusLabel,
        statusTone,
        fromDraft: true,
      });
    }
  }

  rows.sort((a, b) => {
    if (a.orderId !== b.orderId) return a.orderId.localeCompare(b.orderId);
    return a.position - b.position;
  });
  return rows;
}

export function mergeZkTeethPreviewWithDrafts(
  orderRows: ZkTeethPreviewRow[],
  draftRows: ZkTeethPreviewRow[]
): ZkTeethPreviewRow[] {
  return [...draftRows, ...orderRows];
}
