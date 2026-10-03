import { after } from "next/server";
import { refreshStockWatchSupplier } from "@/lib/stock-watch/worker";

/**
 * Po złożeniu zamówienia: przelicz analizę Braki tych dostawców po odpowiedzi
 * (karty panelu dziennego / Braki aktualne bez czekania na noc). Po kolei —
 * zaznaczenie wielu dostawców nie zasypuje Subiekta równoległymi zapytaniami.
 */
export function refreshStockWatchAfterOrder(supplierIds: readonly (string | null | undefined)[]): void {
  const unique = [...new Set(supplierIds.map((id) => String(id ?? "").trim()).filter(Boolean))];
  if (unique.length === 0) return;
  after(async () => {
    for (const id of unique) await refreshStockWatchSupplier(id);
  });
}
