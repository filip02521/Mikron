import type { IndividualOrder } from "@/types/database";
import {
  effectiveSalesCancelPhase,
  isSalesCancelledForQueue,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";

export type ProcurementCancelDisposition = "to_stock" | "return";

const DISPOSITION_LABELS: Record<ProcurementCancelDisposition, string> = {
  to_stock: "Na stan magazynu",
  return: "Przygotować do zwrotu",
};

export function procurementDispositionLabel(
  value: string | null | undefined
): string | null {
  if (value === "to_stock" || value === "return") {
    return DISPOSITION_LABELS[value];
  }
  return null;
}

export function needsProcurementCancelDisposition(order: IndividualOrder): boolean {
  if (!isSalesCancelledForQueue(order)) return false;
  if (order.procurement_cancel_disposition) return false;
  return true;
}

export function procurementDispositionSummary(
  disposition: string | null | undefined,
  note: string | null | undefined
): string | null {
  const label = procurementDispositionLabel(disposition);
  if (!label) return null;
  const trimmed = note?.trim();
  return trimmed ? `${label} — ${trimmed}` : label;
}

/** Etykieta na wpisie w kolejce dostaw (tylko po decyzji zakupów). */
export function procurementDispositionQueueLabel(
  order: IndividualOrder
): string | null {
  const summary = procurementDispositionSummary(
    order.procurement_cancel_disposition,
    order.procurement_cancel_disposition_note
  );
  if (!summary) return null;
  return `Zakupy: ${summary}`;
}

export function salesCancelPhaseNeedsDisposition(phase: SalesCancelPhase | null): boolean {
  return phase === "in_transit" || phase === "on_stock";
}

export function effectiveCancelPhaseForOrder(
  order: IndividualOrder
): SalesCancelPhase | null {
  return effectiveSalesCancelPhase(order);
}
