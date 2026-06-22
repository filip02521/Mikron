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
    "Prośby klienta do pozycji z tego ZK — aktywne u góry, zrealizowane zostają w podglądzie (m.in. dla ilości zamówionej vs ZK).",
  note: "Notatka tylko dla Ciebie — skrót widać na liście ZK. Kliknięcie skrótu otwiera edycję tutaj.",
  details: "Dane klienta i ZK zsynchronizowane z Subiekta.",
  lines:
    "Postęp realizacji wybranych pozycji. Domyślnie widać zakres z konfiguracji ZK — pełną listę z Subiekta rozwiniesz przyciskiem w sekcji.",
} as const;

/** Copy sekcji powiązanych prośb w modalu ZK. */
export const ZK_MODAL_PROSBA_COPY = {
  emptyTitle: "Brak powiązanych prośb",
  emptyHintPrefix: "Użyj przycisku na karcie ZK:",
  createProsbaAction: "Utwórz prośbę",
  supplementAction: "Uzupełnij",
  archivedEmpty: "Brak aktywnych prośb.",
  previewLinkTitle: "Otwórz tę prośbę w Moje zamówienia",
} as const;
