// Czysty moduł (bez bazy) — importowany też przez komponenty klienckie.

import { warsawTodayDateKey } from "@/lib/warehouse/delivery-receipts-shared";

/**
 * Skrót analizy per dostawca — panel dzienny, szuflada dostawcy, wybór w Kreatorze.
 * Liczone jak propozycja w panelu Braki (`buildStockWatchDashboard`): reguły
 * „Wyklucz” / „Na prośbę” na żywo, „pilne” tylko wśród pozycji Do ZD.
 */
export type StockWatchSupplierSignal = {
  /** Pozycje „Do ZD” — to samo co Kreator i karta w panelu Braki. */
  lineCount: number;
  /** Wartość wycenionych pozycji Do ZD (ostatnie ceny z ZD). */
  orderValue: number;
  /** Pozycje Do ZD bez ceny — nie wchodzą do `orderValue`. */
  unpricedCount: number;
  /** Brak towaru + ≤ 48 h wśród pozycji Do ZD („pilne” w panelu Braki). */
  criticalCount: number;
  /** Towary (Standard), które skończą się przed dostawą zamówienia złożonego dziś. */
  beforeDeliveryCount: number;
  /** Najkrótszy zapas wśród pozycji Do ZD. */
  mostUrgent: { twSymbol: string | null; twNazwa: string; daysOfCover: number | null } | null;
  /** Zapas z karty dostawcy (dni). */
  dniZapasu: number;
  /** Czas dostawy z historii (dni) — null, gdy nieznany. */
  leadDays: number | null;
  nextOrderDate: string | null;
  nextOrderDays: number | null;
  /** Dzień danych analizy (koniec okna sprzedaży). */
  dataDo: string;
  /** Kiedy policzono (ISO) — do oznaczenia nieaktualnej analizy. */
  computedAt: string;
};

/** Dni do kolejnego zamówienia od dziś (data z planu), nie od dnia analizy. */
export function stockWatchLiveNextOrderDays(
  s: { nextOrderDate?: string | null; nextOrderDays: number | null },
  todayKey = warsawTodayDateKey()
): number | null {
  if (s.nextOrderDate) {
    const diff = Math.round((Date.parse(s.nextOrderDate) - Date.parse(todayKey)) / 86_400_000);
    if (Number.isFinite(diff)) return Math.max(0, diff);
  }
  return s.nextOrderDays;
}

/** Horyzont „do kolejnej dostawy” (dni od dziś) — null, gdy nieznany. */
export function stockWatchHorizonDays(
  s: { leadDays: number | null; nextOrderDate?: string | null; nextOrderDays: number | null },
  todayKey?: string
): number | null {
  const next = stockWatchLiveNextOrderDays(s, todayKey);
  return s.leadDays != null && next != null ? next + s.leadDays : null;
}

/**
 * Czy opcja Kreatora „Do kolejnej dostawy” zmieni ilości: dni do kolejnego
 * zamówienia (od dziś) + dostawa przekraczają zapas z karty.
 */
export function stockWatchHorizonExtends(
  s: {
    leadDays: number | null;
    nextOrderDate?: string | null;
    nextOrderDays: number | null;
    dniZapasu: number;
  },
  todayKey?: string
): boolean {
  const horizon = stockWatchHorizonDays(s, todayKey);
  return horizon != null && horizon > s.dniZapasu;
}

/**
 * „Przygotuj ZD”: domyślny horyzont (zapas z karty) nie obejmie pozycji zagrożonych przed
 * dostawą, gdy poza nimi nie ma nic Do ZD — wtedy od razu „do kolejnej dostawy”.
 */
export function stockWatchPrepareZdUsesHorizon(s: {
  lineCount: number;
  beforeDeliveryCount: number;
}): boolean {
  return s.lineCount === 0 && s.beforeDeliveryCount > 0;
}

/** Analiza starsza niż 36 h (nocny przebieg nie doszedł) — liczby mogą być nieaktualne. */
export function stockWatchSignalStale(computedAt: string, now = Date.now()): boolean {
  const t = Date.parse(computedAt);
  return !Number.isFinite(t) || now - t > 36 * 3600 * 1000;
}
