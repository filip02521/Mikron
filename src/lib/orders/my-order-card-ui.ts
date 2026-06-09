import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { isInformacjaAvailabilityPendingStatusTitle } from "@/lib/orders/informacja-flow-copy";
import { isProsbaHandoffStatus } from "@/lib/orders/my-order-sales-ui";

/** Czy wiersz wymaga potwierdzenia od handlowca (odbiór, anulowanie, informacja). */
export function rowNeedsSalesAcknowledgement(row: MyOrderRow): boolean {
  if (row.acknowledgeMode === "pickup" || row.acknowledgeMode === "availability") {
    return row.pickupPendingCount > 0;
  }
  if (row.acknowledgeMode === "cancelled") {
    return row.cancelledAckOrderIds.length > 0;
  }
  if (row.acknowledgeMode === "cancel_notice") {
    return row.cancelNoticeOrderIds.length > 0;
  }
  return false;
}

/**
 * Pełny pasek nad wierszem — tylko gdy jest akcja do wykonania i nie ma zwartego układu sekcji.
 * Statusy „w toku” (po terminie, część na magazynie) są w treści wiersza + lewa krawędź.
 */
export function shouldShowMyOrderHeadlineBanner(
  row: MyOrderRow,
  opts: { expanded: boolean; compactActionLayout: boolean; canAcknowledge: boolean }
): boolean {
  if (opts.expanded || opts.compactActionLayout || !opts.canAcknowledge) return false;
  return rowNeedsSalesAcknowledgement(row);
}

/** Badge statusu — ukryty, gdy nagłówek wiersza już niesie ten sam komunikat. */
export function shouldShowOrderStatusBadge(row: MyOrderRow): boolean {
  if (rowNeedsSalesAcknowledgement(row)) return false;
  if (row.headlineTone === "action" || row.headlineTone === "success") return false;
  if (row.headlineTone === "warning" || row.headlineTone === "info") return false;
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
