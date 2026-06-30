import { groupTeethDetails, type TeethGroupedDetail, type TeethLineDetail } from "@/lib/teeth/teeth-catalog";
import {
  orderTeethListReadyForOrder,
  type TeethPanelReadinessContext,
} from "@/lib/teeth/teeth-panel-order-readiness";
import type { IndividualOrderTeethDetail } from "@/types/database";
export type TeethOrderSpecSummary = {
  orderId: string;
  salesPersonName: string | null;
  product: string;
  symbol: string | null;
  quantity: string;
  groups: TeethGroupedDetail[];
  pieceCount: number;
  hasSpec: boolean;
};

export type TeethSupplierBatchSummary = {
  mergedGroups: TeethGroupedDetail[];
  totalPieces: number;
  orderCount: number;
  ordersWithSpec: number;
  ordersMissingSpec: number;
  byOrder: TeethOrderSpecSummary[];
};

function teethDetailKey(g: Pick<TeethGroupedDetail, "color" | "mould" | "jaw" | "kind">): string {
  return `${g.color}|${g.mould ?? ""}|${g.jaw ?? ""}|${g.kind ?? ""}`;
}

/** Scala wiele list grup zębów w jedną (sumuje sztuki tej samej specyfikacji). */
export function mergeTeethGroupedDetails(groups: TeethGroupedDetail[][]): TeethGroupedDetail[] {
  const map = new Map<string, TeethGroupedDetail>();
  for (const list of groups) {
    for (const g of list) {
      const key = teethDetailKey(g);
      const existing = map.get(key);
      if (existing) {
        existing.count += g.count;
      } else {
        map.set(key, { ...g });
      }
    }
  }
  return Array.from(map.values());
}

function toLineDetails(details: IndividualOrderTeethDetail[] | null | undefined): TeethLineDetail[] {
  if (!details?.length) return [];
  return details.map((d) => ({
    position: d.position,
    color: d.color,
    mould: d.mould,
    jaw: d.jaw,
    kind: d.kind,
  }));
}

export function summarizeTeethOrder(
  input: {
    orderId: string;
    salesPersonName?: string | null;
    product: string;
    symbol?: string | null;
    quantity: string;
    teethDetails?: IndividualOrderTeethDetail[] | null;
    subiektTwId?: number | null;
  },
  ctx?: TeethPanelReadinessContext,
): TeethOrderSpecSummary {
  const lines = toLineDetails(input.teethDetails);
  const groups = groupTeethDetails(lines);
  return {
    orderId: input.orderId,
    salesPersonName: input.salesPersonName ?? null,
    product: input.product,
    symbol: input.symbol && input.symbol !== "-" ? input.symbol : null,
    quantity: input.quantity,
    groups,
    pieceCount: lines.length,
    hasSpec: orderTeethListReadyForOrder(
      {
        teeth_details: input.teethDetails,
        products: input.product,
        quantity: input.quantity,
        subiekt_tw_id: input.subiektTwId ?? null,
      },
      ctx,
    ),
  };
}

/** Podsumowanie wielu prośb tego samego dostawcy — do zamówienia telefonicznego u Mikran. */
export function buildTeethSupplierBatchSummary(
  orders: Array<{
    id: string;
    products: string;
    symbol?: string | null;
    quantity: string;
    sales_person_name?: string | null;
    teeth_details?: IndividualOrderTeethDetail[] | null;
    subiekt_tw_id?: number | null;
  }>,
  ctx?: TeethPanelReadinessContext,
): TeethSupplierBatchSummary {
  const byOrder = orders.map((o) =>
    summarizeTeethOrder(
      {
        orderId: o.id,
        salesPersonName: o.sales_person_name,
        product: o.products,
        symbol: o.symbol,
        quantity: o.quantity,
        teethDetails: o.teeth_details,
        subiektTwId: o.subiekt_tw_id,
      },
      ctx,
    ),
  );

  const withSpec = byOrder.filter((o) => o.hasSpec);
  const mergedGroups = mergeTeethGroupedDetails(withSpec.map((o) => o.groups));
  const totalPieces = withSpec.reduce((sum, o) => sum + o.pieceCount, 0);

  return {
    mergedGroups,
    totalPieces,
    orderCount: byOrder.length,
    ordersWithSpec: withSpec.length,
    ordersMissingSpec: byOrder.length - withSpec.length,
    byOrder,
  };
}
