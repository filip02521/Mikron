/** Odmiana „pozycja” — np. 1 pozycja, 2 pozycje, 5 pozycji. */
export function plPozycja(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "pozycja";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "pozycje";
  return "pozycji";
}

/** Odmiana „prośba” — np. 1 prośba, 2 prośby, 5 próśb. */
export function plProsba(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "prośba";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "prośby";
  return "próśb";
}

/**
 * Odmiana „klapka” (płytka zębów: przody 6, boki 8) — 1 klapka, 2 klapki, 5 klapek.
 * Zęby sprzedajemy i zamawiamy tylko w klapkach; jedna pozycja listy = jedna klapka.
 */
export function plKlapka(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "klapka";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "klapki";
  return "klapek";
}

/** Biernik „klapka” po czasowniku — „Oznacz 1 klapkę”, „Oznacz 2 klapki”, „Wycofaj 5 klapek”. */
export function plKlapkeBiernik(count: number): string {
  return Math.abs(Math.trunc(count)) === 1 ? "klapkę" : plKlapka(count);
}

/** Odmiana „wiersz” — np. 1 wiersz, 2 wiersze, 5 wierszy. */
export function plWiersz(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "wiersz";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "wiersze";
  return "wierszy";
}

/** Odmiana „zaznaczona pozycja” w dopełniaczu — np. dla 2 zaznaczonych pozycji. */
export function plZaznaczonaPozycja(count: number): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return "zaznaczonej pozycji";
  return "zaznaczonych pozycji";
}

/** Etykieta interwału tygodniowego w harmonogramie. */
export function plCoTydzien(weeks: number): string {
  if (weeks === 1) return "Co tydzień";
  const n = Math.abs(Math.trunc(weeks));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `Co ${n} tygodnie`;
  }
  return `Co ${n} tygodni`;
}

/** Odmiana „dzień roboczy” — np. 1 dzień roboczy, 2 dni robocze, 5 dni roboczych. */
export function plDzienRoboczy(count: number): string {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (n === 1) return "dzień roboczy";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "dni robocze";
  return "dni roboczych";
}
