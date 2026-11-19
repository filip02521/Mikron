import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import { stockSnapshotFromLineDraft } from "@/lib/orders/prosba-stock-check";

/**
 * „Zgłoś brak na stanie” przy pozycji prośby: osobny sygnał dla zakupów (prośba informacyjna z flagą
 * braku), nie zmienia rodzaju ani treści prośby, którą handlowiec właśnie składa.
 */
export type ProsbaStockOutReportResult =
  | { ok: true }
  | { ok: false; alreadyReported: boolean; message: string };

/** Panel tylko przy towarze z Subiekta, gdy na półce nie ma nic wolnego (zęby mają własny obieg). */
export function prosbaLineOffersStockOutReport(
  line: Pick<
    ProductLineDraft,
    "subiektTwId" | "onHand" | "reserved" | "available" | "stockSource" | "teethManufacturer"
  >
): boolean {
  if (line.subiektTwId == null || line.teethManufacturer) return false;
  const stock = stockSnapshotFromLineDraft(line);
  return stock != null && stock.available <= 0;
}
