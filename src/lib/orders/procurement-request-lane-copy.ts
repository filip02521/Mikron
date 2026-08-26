/** Copy PL — tory próśb w panelu dziennym. */
export const PROCUREMENT_REQUEST_LANE_COPY = {
  triage: "Do rozdzielenia",
  doZamowienia: "Do zamówienia",
  magazynInfo: "Magazyn → info",
  urlop: "Urlop",
  orphanFlag: "Nieznana flaga",
  /** @deprecated seed labels — zostawione dla skrótów fallback */
  pilne: "Pilne",
  doSprawdzenia: "Do sprawdzenia",
  czekaNaKlienta: "Czeka na klienta",
  doWyjasnienia: "Do wyjaśnienia",
  wstrzymane: "Wstrzymane",
  inneFlagi: "Inne flagi",
  navLabel: "Tory",
  manageFlags: "Zarządzaj",
  /** Skrót w menu — ustawia flagę; tor układa się sam. */
  setFlag: "Flaga:",
  clearFlag: "Wyczyść flagę",
  flagOrderToast: "Zapisano kolejność torów",
  flagSetToast: "Ustawiono flagę",
  flagClearedToast: "Usunięto flagę",
  triageHint:
    "Nowe lub jeszcze nierozdzielone — zawsze na górze listy torów. Ustaw flagę albo zamów.",
  doSprawdzeniaHint: "Sprawdzenie ceny / dostępności u dostawcy przed zamówieniem.",
  doZamowieniaHint: "Gotowe do Główne / Uzupełniające.",
  magazynInfoHint: "Prośby z panelu Informacja — do potwierdzenia magazynu.",
  urlopHint: "Dostawca na urlopie — zamówienie poczeka albo inna ścieżka.",
  laneCollapse: "Zwiń tor — zostaw tylko nowe",
  laneExpand: "Rozwiń tor — pokaż wszystkie prośby",
  /** Zwinięty tor z częściowym podglądem nieprzeczytanych. */
  laneCollapsedPeekHint: "Tylko nowe — rozwiń, by zobaczyć wszystkie",
  /** Zwinięty tor: wszystkie pozycje to nieprzeczytane (peek = całość). */
  laneCollapsedAllNewHint: "Nowe w tym torze — rozwiń, by przejrzeć listę",
  /** Zwinięty tor bez peeka (same przeczytane). */
  laneCollapsedEmptyHint: "Rozwiń, by zobaczyć wszystkie",
  /** Dopisek przy Zamów razem w częściowym peeku. */
  lanePeekOrderScopeNote:
    "W podglądzie zwiniętego toru widać tylko nowe — rozwiń tor, by zamówić wszystkich u tego dostawcy w tej sekcji.",
  laneMoveUp: "Tor wyżej",
  laneMoveDown: "Tor niżej",
} as const;
