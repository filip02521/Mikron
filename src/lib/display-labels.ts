import {
  formatIntervalLabel,
  resolveSupplierInterval,
} from "@/lib/orders/dates";
import type { OrderType, SupplierLocation, VacationNote } from "@/types/database";

const LOCATION_LABELS: Record<SupplierLocation, string> = {
  POLSKA: "Polska",
  ZAGRANICA: "Zagranica",
  IMPORT: "Import",
};

const VACATION_LABELS: Record<VacationNote, string> = {
  PRZESUNIETE_PO: "Przesunięte po urlopie",
  PRZYSPIESZONE_PRZED: "Przyspieszone przed urlopem",
  OSTATNIE_ZAMOWIENIE: "Ostatnie zamówienie przed urlopem",
};

export function locationLabel(location: string): string {
  return LOCATION_LABELS[location as SupplierLocation] ?? location;
}

export function vacationNoteLabel(note: string | null | undefined): string {
  if (!note) return "—";
  return VACATION_LABELS[note as VacationNote] ?? note;
}

export function formatSupplierInterval(
  intervalRaw: string | null | undefined,
  intervalWeeks: number | null | undefined
): string {
  const resolved = resolveSupplierInterval(intervalRaw, intervalWeeks);
  if (resolved) return formatIntervalLabel(resolved);
  if (intervalRaw?.trim()) return intervalRaw.trim();
  return "—";
}

/** Widok handlowca — „3 tyg.” jako „raz na 3 tyg.” (co ile składamy zamówienie u dostawcy). */
export function formatSupplierIntervalForSales(
  intervalRaw: string | null | undefined,
  intervalWeeks: number | null | undefined
): string {
  const resolved = resolveSupplierInterval(intervalRaw, intervalWeeks);
  if (resolved) {
    if (resolved.unit === "weeks") {
      if (resolved.value === 1) return "co tydzień";
      return `raz na ${resolved.value} tyg.`;
    }
    if (resolved.value === 1) return "co miesiąc";
    return `raz na ${resolved.value} mies.`;
  }
  if (intervalRaw?.trim()) return intervalRaw.trim();
  return "—";
}

export function orderTypeLabel(type: OrderType): string {
  switch (type) {
    case "Glowne":
      return "Główne";
    case "Poboczne":
      return "Uzupełniające";
    default:
      return "—";
  }
}

export function orderMethodLabel(notes: string): string {
  const u = (notes || "").toUpperCase();
  if (u.includes("MAIL")) return "Mail";
  if (u.includes("TELEFON")) return "Telefon";
  if (u.includes("INTERNET")) return "Internet";
  return notes || "—";
}

export type OrderMethodKind = "mail" | "phone" | "web" | "other";

export function orderMethodKind(notes: string): OrderMethodKind {
  const u = (notes || "").toUpperCase();
  if (u.includes("MAIL")) return "mail";
  if (u.includes("TELEFON")) return "phone";
  if (u.includes("INTERNET")) return "web";
  return "other";
}

/** Zapas — okres, na który zamawiasz (np. 2 miesiące = duże zamówienie na 2 mies.) */
export function formatStockPeriod(
  stockRaw: string | null | undefined,
  stockWeeks: number | null | undefined
): string {
  const v = stockRaw?.trim();
  if (!v) {
    if (stockWeeks != null && stockWeeks > 0) {
      return `Zapas na ${formatIntervalLabel({ unit: "weeks", value: Math.round(stockWeeks) })}`;
    }
    return "—";
  }
  if (/w razie potrzeby/i.test(v)) return "W razie potrzeby";
  const resolved = resolveSupplierInterval(v, stockWeeks);
  if (resolved) return `Zapas na ${formatIntervalLabel(resolved)}`;
  return v;
}

/** ISO yyyy-mm-dd → dd.MM.yyyy */
export function formatPlDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}
