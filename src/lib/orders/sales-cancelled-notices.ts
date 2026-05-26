import { formatPlDate } from "@/lib/display-labels";
import { isInformacjaRequest } from "@/lib/orders/individual";
import {
  procurementDispositionSummary,
  salesCancelPhaseNeedsDisposition,
} from "@/lib/orders/procurement-disposition";
import {
  effectiveSalesCancelPhase,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";
import { mapOrderToForSomeoneLine } from "@/lib/orders/product-source";
import type { ForSomeoneLine } from "@/lib/orders/summary-workspace";
import type { IndividualOrder, SupplierLocation } from "@/types/database";

export type SalesCancelledNotice = {
  id: string;
  supplierId: string;
  salesPersonId: string;
  supplierName: string;
  location: SupplierLocation;
  person: string;
  clientName: string | null;
  cancelledLabel: string;
  phase: SalesCancelPhase;
  phaseLabel: string;
  /** Ustawione przez magazyn (stan / zwrot). */
  dispositionSummary: string | null;
  needsDisposition: boolean;
  lines: ForSomeoneLine[];
  orderIds: string[];
};

export function procurementSalesCancelPhaseLabel(phase: SalesCancelPhase): string {
  switch (phase) {
    case "before_order":
      return "Wycofane zamówienie dla klienta";
    case "in_transit":
      return "Rezygnacja — towar może nadal przyjechać";
    case "on_stock":
      return "Rezygnacja — towar na magazynie";
  }
}

function resolveNoticePhase(orders: IndividualOrder[]): SalesCancelPhase {
  const phases = orders
    .map((o) => effectiveSalesCancelPhase(o))
    .filter((p): p is SalesCancelPhase => p !== null);
  if (phases.includes("on_stock")) return "on_stock";
  if (phases.includes("in_transit")) return "in_transit";
  return "before_order";
}

/** Zamówienia dla klientów wycofane przez handlowca — tylko niepotwierdzone przez zakupy (bez informacji). */
export function buildSalesCancelledNotices(
  orders: IndividualOrder[],
  salesById: Map<string, string>
): SalesCancelledNotice[] {
  const withCancel = orders.filter((o) => {
    if (isInformacjaRequest(o)) return false;
    if (!o.sales_cancelled_at) return false;
    if (o.procurement_sales_cancel_ack_at) return false;
    const phase = effectiveSalesCancelPhase(o);
    if (!phase) return false;
    if (salesCancelPhaseNeedsDisposition(phase) && o.procurement_cancel_disposition) {
      return false;
    }
    return true;
  });
  const grouped = new Map<string, IndividualOrder[]>();

  for (const o of withCancel) {
    const key = `${o.supplier_id ?? "none"}|${o.sales_person_id}`;
    const list = grouped.get(key) ?? [];
    list.push(o);
    grouped.set(key, list);
  }

  const notices: SalesCancelledNotice[] = [];

  for (const [key, items] of grouped) {
    items.sort(
      (a, b) =>
        (b.sales_cancelled_at ?? "").localeCompare(a.sales_cancelled_at ?? "")
    );
    const first = items[0];
    const ackAt = first.sales_cancelled_at!;
    const phase = resolveNoticePhase(items);
    const dispositionSummary =
      items
        .map((i) =>
          procurementDispositionSummary(
            i.procurement_cancel_disposition,
            i.procurement_cancel_disposition_note
          )
        )
        .find(Boolean) ?? null;
    const clientName =
      items.map((i) => i.sales_client_name?.trim()).find(Boolean) ?? null;
    notices.push({
      id: key,
      supplierId: first.supplier_id ?? "",
      salesPersonId: first.sales_person_id,
      supplierName: first.supplier?.name ?? "—",
      location: first.supplier?.location ?? "POLSKA",
      person:
        first.sales_person?.name ?? salesById.get(first.sales_person_id) ?? "—",
      clientName,
      cancelledLabel: formatPlDate(ackAt.slice(0, 10)),
      phase,
      phaseLabel: procurementSalesCancelPhaseLabel(phase),
      dispositionSummary,
      needsDisposition: salesCancelPhaseNeedsDisposition(phase),
      lines: items.map((item) => mapOrderToForSomeoneLine(item)),
      orderIds: items.map((i) => i.id),
    });
  }

  notices.sort((a, b) => b.cancelledLabel.localeCompare(a.cancelledLabel, "pl"));

  return notices;
}
