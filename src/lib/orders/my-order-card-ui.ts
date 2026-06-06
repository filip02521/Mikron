import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { isInformacjaAvailabilityPendingStatusTitle } from "@/lib/orders/informacja-flow-copy";
import { isProsbaHandoffStatus } from "@/lib/orders/my-order-sales-ui";

/** Badge statusu — ukryty, gdy kolorowy pasek już mówi to samo. */
export function shouldShowOrderStatusBadge(row: MyOrderRow): boolean {
  if (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") {
    return false;
  }
  if (row.headlineTone === "action" || row.headlineTone === "success") return false;
  return true;
}

/** Szary opis w rozwinięciu — tylko gdy dodaje coś ponad nagłówek. */
export function shouldShowOrderStatusDetail(row: MyOrderRow): boolean {
  if (!row.statusDetail?.trim()) return false;
  if (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") {
    return false;
  }
  if (row.kind === "informacja" && row.statusTitle === "Dostępne") return false;
  if (row.statusTitle === "Zamówione" && row.headlineTone === "info") return false;
  if (row.statusTitle === "Przed zamówieniem") return false;
  if (
    isInformacjaAvailabilityPendingStatusTitle(row.statusTitle) ||
    row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
    row.statusTitle === "Zamówione — czekamy na magazyn"
  ) {
    return false;
  }
  if (isProsbaHandoffStatus(row.statusTitle)) return false;
  return true;
}

export function progressLabelInSubline(row: MyOrderRow): boolean {
  const s = row.subline ?? "";
  return s.includes("Magazyn") || /\d+\s*z\s*\d+/.test(s) || s.includes("szt.");
}
