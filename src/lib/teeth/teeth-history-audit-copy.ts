import type { TeethOrderHistoryAction } from "@/lib/data/teeth-order-history";

export const TEETH_ORDER_HISTORY_ACTION_LABELS: Record<TeethOrderHistoryAction, string> = {
  ordered: "Oznaczono zamówione u labu",
  unmark: "Cofnięto do kolejki",
  delivery_override: "Ustawiono datę dostawy",
  delivery_clear: "Wyczyszczono datę dostawy",
  schedule_ordered: "Zaktualizowano harmonogram (zamówione)",
  schedule_shift: "Przesunięto harmonogram",
};

export function teethOrderHistorySummary(
  action: TeethOrderHistoryAction,
  orderCount: number,
  meta?: Record<string, unknown>
): string {
  const base = TEETH_ORDER_HISTORY_ACTION_LABELS[action];
  const countPart =
    orderCount > 0
      ? ` · ${orderCount} ${orderCount === 1 ? "pozycja" : orderCount < 5 ? "pozycje" : "pozycji"}`
      : "";
  const deliveryDate =
    typeof meta?.deliveryDate === "string" && meta.deliveryDate.trim()
      ? ` → ${meta.deliveryDate.trim()}`
      : "";
  const shiftDate =
    typeof meta?.shiftDate === "string" && meta.shiftDate.trim()
      ? ` → ${meta.shiftDate.trim()}`
      : "";
  if (action === "delivery_override") return `${base}${deliveryDate}${countPart}`;
  if (action === "schedule_shift") return `${base}${shiftDate}`;
  return `${base}${countPart}`;
}
