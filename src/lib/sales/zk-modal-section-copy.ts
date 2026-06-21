/** Nagłówki sekcji modalu szczegółów ZK. */
export const ZK_MODAL_SECTION_TITLES = {
  prosba: "Powiązane prośby",
  note: "Notatka do sprawy",
  details: "Szczegóły",
  lines: "Lista towaru",
} as const;

/** Podpowiedzi (?) sekcji modalu szczegółów ZK. */
export const ZK_MODAL_SECTION_HINTS = {
  prosba:
    "Aktywne prośby klienta do pozycji z tego ZK. Podgląd otwiera sprawę w Moje zamówienia z podświetleniem.",
  note: "Notatka tylko dla Ciebie — skrót widać na liście ZK. Kliknięcie skrótu otwiera edycję tutaj.",
  details: "Dane klienta i ZK zsynchronizowane z Subiekta.",
  lines:
    "Postęp realizacji pozycji. Towar na regale zaznacza się sam; po odbiorze w Moje możesz ręcznie domknąć checkbox.",
} as const;

/** Copy sekcji powiązanych prośb w modalu ZK. */
export const ZK_MODAL_PROSBA_COPY = {
  emptyTitle: "Brak powiązanych prośb",
  emptyHintPrefix: "Użyj przycisku na karcie ZK:",
  createProsbaAction: "Utwórz prośbę",
  supplementAction: "Uzupełnij",
  coveredTitle: "Pozycje objęte prośbami",
  archivedEmpty: "Brak aktywnych prośb.",
  previewLinkTitle: "Otwórz tę prośbę w Moje zamówienia",
} as const;
