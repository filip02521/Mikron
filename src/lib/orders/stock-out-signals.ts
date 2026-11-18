/**
 * Zgłoszenia „brak na stanie” od handlowców (prośba informacyjna z flagą `informacja_stock_out_reorder`):
 * odznaka w Kreatorze ZD i samodzielne zamknięcie, gdy towar trafi do ZD.
 * Logika czysta — odczyt i zapis w `stock-out-signals-db.ts`.
 */

import type { ProsbaIncomingZdDoc } from "@/lib/orders/prosba-already-ordered";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

/** Aktywne zgłoszenie z tw z Subiekta — to, co Kreator i automat zamknięcia widzą. */
export type ActiveStockOutSignal = {
  orderId: string;
  twId: number;
  createdAt: string;
  salesPersonName: string;
  supplierId: string | null;
};

/** Odznaka w wierszu Kreatora: ile zgłoszeń, kto, od kiedy. */
export type ZdStockOutBadge = {
  count: number;
  salesPeople: string[];
  /** YYYY-MM-DD najstarszego zgłoszenia. */
  since: string;
};

export function stockOutBadgesByTwId(signals: readonly ActiveStockOutSignal[]): Record<number, ZdStockOutBadge> {
  const out: Record<number, ZdStockOutBadge> = {};
  for (const s of signals) {
    const day = warsawDateKeyFromIso(s.createdAt);
    const prev = out[s.twId];
    if (!prev) {
      out[s.twId] = { count: 1, salesPeople: [s.salesPersonName], since: day };
      continue;
    }
    prev.count += 1;
    if (!prev.salesPeople.includes(s.salesPersonName)) prev.salesPeople.push(s.salesPersonName);
    if (day < prev.since) prev.since = day;
  }
  return out;
}

export function stockOutBadgeTitle(b: ZdStockOutBadge): string {
  const who = b.salesPeople.join(", ");
  const [y, m, d] = b.since.split("-");
  return `Handlowiec zgłosił brak na stanie (${who}, od ${d}.${m}.${y}). Zgłoszenie zamknie się samo, gdy towar trafi do ZD.`;
}

export type StockOutCoveredByZd = {
  orderId: string;
  dokNr: string;
  /** Dostawca z indeksu ZD — uzupełnia zgłoszenie bez dostawcy. */
  supplierId: string | null;
};

/**
 * Zgłoszenie jest „zamówione”, gdy towar jest na otwartym ZD wystawionym w dniu zgłoszenia albo później.
 * Starsze ZD nie zamykają: towar był już w drodze, a handlowiec mimo to zgłosił brak — decyzja zostaje dla zakupów.
 */
export function stockOutSignalsCoveredByZd(
  signals: readonly ActiveStockOutSignal[],
  docsByTwId: ReadonlyMap<number, readonly ProsbaIncomingZdDoc[]>
): StockOutCoveredByZd[] {
  const out: StockOutCoveredByZd[] = [];
  for (const s of signals) {
    const reportedDay = warsawDateKeyFromIso(s.createdAt);
    const doc = (docsByTwId.get(s.twId) ?? []).find((d) => d.issued != null && d.issued >= reportedDay);
    if (!doc) continue;
    out.push({ orderId: s.orderId, dokNr: doc.dokNr, supplierId: doc.supplierId ?? null });
  }
  return out;
}
