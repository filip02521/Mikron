/** Copy strony ZK czekające — nagłówek, sekcje, skróty. */
export const ZK_PAGE_SECTION_COPY = {
  /** Etykieta ARIA listy (nagłówek strony: „ZK czekające”). */
  listTitle: "Lista zamówień klientów",
  listHint:
    "Rozwiń kartę ZK, aby zobaczyć pozycje i statusy. Szukaj po kliencie, numerze lub produkcie.",
  addTitle: "Dodaj ZK z Subiekta",
  addDescription:
    "Krótki numer (min. 2 znaki) — ostatnie 30 dni. Pełny format, np. 234/M/03/2026 — tylko dany miesiąc. Nie filtruje listy poniżej.",
  todayTasksTitle: "Do zrobienia dziś",
} as const;

export const ZK_KEYBOARD_HINTS = [
  { keys: ["/"], label: "szukaj na liście" },
  { keys: ["Esc"], label: "wyczyść filtr" },
] as const;

/** Badge: nieodczytane ZK z nowym towarem na regale (nie liczba pozycji). */
export function formatZkUnseenRegalBadge(count: number): string {
  return count === 1
    ? "1 ZK — nowy towar na regale"
    : `${count} ZK — nowy towar na regale`;
}
