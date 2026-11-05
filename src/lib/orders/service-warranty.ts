import { parseDateOnly, toDateOnly } from "@/lib/orders/service-loaners";

/**
 * Gwarancja sprzętu w serwisie. Subiekt nie zna okresu gwarancji, więc liczy go OnTime: domyślnie 24 miesiące
 * od daty zakupu (FS/PA albo data wpisana przy przyjęciu), dla modelu z katalogu — jego okres.
 */
export const SERVICE_WARRANTY_DEFAULT_MONTHS = 24;
export const SERVICE_WARRANTY_MONTHS_MAX = 120;

export type WarrantyState = "active" | "expired" | "unknown";

export type WarrantyStatus = {
  state: WarrantyState;
  /** YYYY-MM-DD — ostatni dzień gwarancji. */
  until: string | null;
};

/** Okres modelu z katalogu albo domyślny. */
export function warrantyMonthsFor(modelTwId: number | null, byModel: ReadonlyMap<number, number>): number {
  return (modelTwId != null ? byModel.get(modelTwId) : undefined) ?? SERVICE_WARRANTY_DEFAULT_MONTHS;
}

/**
 * Koniec gwarancji: ten sam dzień miesiąca N miesięcy później; gdy go nie ma (31.01 + 1 mies.) — ostatni dzień
 * miesiąca. Daty lokalne (YYYY-MM-DD), bez przeliczeń przez UTC.
 */
export function warrantyUntil(purchaseDate: string, months: number): string {
  const d = parseDateOnly(purchaseDate);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return toDateOnly(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), lastDay)));
}

/** Stan gwarancji na dany dzień: ostatni dzień gwarancji jeszcze się liczy. */
export function warrantyStatus(until: string | null, today: Date): WarrantyStatus {
  if (!until) return { state: "unknown", until: null };
  return { state: until >= toDateOnly(today) ? "active" : "expired", until };
}

/** Data zakupu z formularza: poprawna data, nie z przyszłości i nie sprzed 2000 r.; inaczej null. */
export function normalizePurchaseDate(raw: string | null | undefined, today: Date): string | null {
  const v = (raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = parseDateOnly(v);
  if (toDateOnly(d) !== v) return null;
  if (v > toDateOnly(today) || v < "2000-01-01") return null;
  return v;
}

/** „DD.MM.RRRR” z YYYY-MM-DD. */
function dmy(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}.${m}.${y}`;
}

/** Krótki opis do odznaki: „Gwarancja do 15.03.2027”, „Po gwarancji (15.03.2025)”, „Brak daty zakupu”. */
export function warrantyLabel(status: WarrantyStatus): string {
  if (status.state === "active") return `Gwarancja do ${dmy(status.until!)}`;
  if (status.state === "expired") return `Po gwarancji (${dmy(status.until!)})`;
  return "Brak daty zakupu";
}
