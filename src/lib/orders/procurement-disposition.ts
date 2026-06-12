import type { IndividualOrder } from "@/types/database";
import {
  effectiveSalesCancelPhase,
  isSalesCancelledForQueue,
  type SalesCancelPhase,
} from "@/lib/orders/sales-cancel";

export type ProcurementCancelDisposition = "to_stock" | "return";

export type ProcurementCancelDispositionInput = {
  orderId: string;
  disposition: ProcurementCancelDisposition;
  note?: string;
};

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

/** Komunikat po zapisie decyzji (jedna lub wiele pozycji). */
export function procurementDispositionSaveSummary(
  entries: ProcurementCancelDispositionInput[],
  personName: string
): string {
  if (!entries.length) return `Zapisano decyzję — ${personName}`;
  if (entries.length === 1) {
    return entries[0]!.disposition === "to_stock"
      ? `Rezygnacja ${personName} — na stan magazynu`
      : `Rezygnacja ${personName} — zwrot do dostawcy`;
  }
  const stock = entries.filter((e) => e.disposition === "to_stock").length;
  const ret = entries.filter((e) => e.disposition === "return").length;
  const parts: string[] = [];
  if (stock > 0) parts.push(`${stock} na stan`);
  if (ret > 0) parts.push(`${ret} do zwrotu`);
  return `Rezygnacja ${personName} — ${parts.join(", ")}`;
}

export function countPendingDispositionChoices(
  lineIds: readonly string[],
  choices: Readonly<Record<string, ProcurementCancelDisposition | null | undefined>>
): { chosen: number; total: number } {
  const total = lineIds.length;
  const chosen = lineIds.filter((id) => choices[id] === "to_stock" || choices[id] === "return")
    .length;
  return { chosen, total };
}
