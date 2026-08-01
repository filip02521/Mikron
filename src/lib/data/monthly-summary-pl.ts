/** Odmiana i skróty polskie dla podsumowania miesięcznego. */

const MONTH_SHORT_PL: Record<string, string> = {
  styczeń: "sty",
  luty: "lut",
  marzec: "mar",
  kwiecień: "kwi",
  maj: "maj",
  czerwiec: "cze",
  lipiec: "lip",
  sierpień: "sie",
  wrzesień: "wrz",
  październik: "paź",
  listopad: "lis",
  grudzień: "gru",
};

/** „czerwiec 2026” → „cze 2026”. */
export function shortMonthLabel(fullLabel: string): string {
  const parts = fullLabel.trim().split(/\s+/);
  if (parts.length < 2) return fullLabel;
  const month = parts[0]!;
  const year = parts[1]!;
  return `${MONTH_SHORT_PL[month] ?? month} ${year}`;
}

/**
 * Polska odmiana: 1 → one, 2–4 (poza 12–14) → few, reszta → many.
 * Przykład: polishPlural(n, "prośba", "prośby", "próśb")
 */
export function polishPlural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

export function formatCount(count: number, one: string, few: string, many: string): string {
  return `${count}\u00a0${polishPlural(count, one, few, many)}`;
}

export const PL = {
  prosba: ["prośba", "prośby", "próśb"] as const,
  przyjecie: ["przyjęcie", "przyjęcia", "przyjęć"] as const,
  zamowienie: ["zamówienie", "zamówienia", "zamówień"] as const,
  paczka: ["paczka", "paczki", "paczek"] as const,
  paleta: ["paleta", "palety", "palet"] as const,
  dzien: ["dzień", "dni", "dni"] as const,
};

export function formatProsby(n: number): string {
  return formatCount(n, ...PL.prosba);
}
export function formatPrzyjecia(n: number): string {
  return formatCount(n, ...PL.przyjecie);
}
export function formatZamowienia(n: number): string {
  return formatCount(n, ...PL.zamowienie);
}
export function formatPaczki(n: number): string {
  return formatCount(n, ...PL.paczka);
}
export function formatPalety(n: number): string {
  return formatCount(n, ...PL.paleta);
}
export function formatDni(n: number): string {
  return formatCount(n, ...PL.dzien);
}

/** Samo słowo po liczbie (np. etykieta pod liczbą w karcie działu). */
export function unitProsby(n: number): string {
  return polishPlural(n, ...PL.prosba);
}
export function unitPrzyjecia(n: number): string {
  return polishPlural(n, ...PL.przyjecie);
}
export function unitZamowienia(n: number): string {
  return polishPlural(n, ...PL.zamowienie);
}
export function unitPaczki(n: number): string {
  return polishPlural(n, ...PL.paczka);
}
export function unitPalety(n: number): string {
  return polishPlural(n, ...PL.paleta);
}

export function formatZlozoneProsby(n: number): string {
  if (n === 1) return "1\u00a0złożona prośba";
  const word = polishPlural(n, "prośba", "prośby", "próśb");
  if (word === "prośby") return `${n}\u00a0złożone prośby`;
  return `${n}\u00a0złożonych próśb`;
}

export function formatZrealizowaneProsby(n: number): string {
  if (n === 1) return "1\u00a0zrealizowana prośba";
  const word = polishPlural(n, "prośba", "prośby", "próśb");
  if (word === "prośby") return `${n}\u00a0zrealizowane prośby`;
  return `${n}\u00a0zrealizowanych próśb`;
}

export function formatZamknieteZk(n: number): string {
  if (n === 1) return "1\u00a0zamknięty dokument ZK";
  const word = polishPlural(n, "dokument", "dokumenty", "dokumentów");
  if (word === "dokumenty") return `${n}\u00a0zamknięte dokumenty ZK`;
  return `${n}\u00a0zamkniętych dokumentów ZK`;
}
