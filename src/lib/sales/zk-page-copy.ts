/** Copy strony ZK czekające — nagłówek, sekcje, skróty. */
export const ZK_PAGE_SECTION_COPY = {
  listTitle: "Twoja lista ZK",
  listHint: "Zamówienia klientów śledzone na tej liście — rozwiń kartę, aby zobaczyć pozycje i statusy.",
  addTitle: "Dodaj ZK z Subiekta",
  addDescription: "Numer z dokumentu magazynowego — to nie filtruje listy poniżej.",
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
