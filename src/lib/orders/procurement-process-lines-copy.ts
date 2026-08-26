/** Copy PL — modal wyboru linii przy Główne / Uzupełniające. */
export const PROCUREMENT_PROCESS_LINES_COPY = {
  titleGlowne: "Główne — wybierz pozycje",
  titlePoboczne: "Uzupełniające — wybierz pozycje",
  modalHint:
    "Odznacz pozycje, których nie zamawiasz teraz. Reszta zostanie na panelu.",
  selectLines: "Pozycje w prośbie",
  selectAll: "Zaznacz wszystkie",
  deselectAll: "Odznacz wszystkie",
  selectedCount: (n: number, total: number) =>
    n >= total ? `Wybrane: wszystkie (${total})` : `Wybrane: ${n} z ${total}`,
  cancel: "Anuluj",
  /** Title na przyciskach gdy grupa ma ≥2 linie. */
  pickLinesHint: "Możesz wybrać część pozycji",
  badgeInfo: "Info",
  badgeStockOut: "Brak",
  qtyPrefix: "×",
  scheduleAlert:
    "Główne może przesunąć termin planowy tego dostawcy w harmonogramie.",
  scheduleAlertPartial:
    "Pozostałe pozycje zostaną na panelu; termin dostawcy i tak może się przesunąć.",
  scheduleAlertOnDemand:
    "Dostawca na żądanie — Główne nie przesuwa terminu w planie tygodnia.",
  loading: "Oznaczanie…",
} as const;
