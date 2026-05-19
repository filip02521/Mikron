import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

/** Badge statusu — ukryty, gdy kolorowy pasek już mówi to samo. */
export function shouldShowOrderStatusBadge(row: MyOrderRow): boolean {
  if (row.acknowledgeMode === "pickup") return false;
  if (row.headlineTone === "action" || row.headlineTone === "success") return false;
  return true;
}

/** Szary opis w rozwinięciu — tylko gdy dodaje coś ponad nagłówek. */
export function shouldShowOrderStatusDetail(row: MyOrderRow): boolean {
  if (!row.statusDetail?.trim()) return false;
  if (row.acknowledgeMode === "pickup") return false;
  if (row.kind === "informacja" && row.statusTitle === "Dostępne") return false;
  if (row.statusTitle === "Zamówione" && row.headlineTone === "info") return false;
  if (row.statusTitle === "Przed zamówieniem") return false;
  if (row.statusTitle === "Oczekuje na dostawę") return false;
  return true;
}

export function progressLabelInSubline(row: MyOrderRow): boolean {
  const s = row.subline ?? "";
  return s.includes("Magazyn") || /\d+\s*z\s*\d+/.test(s) || s.includes("szt.");
}
