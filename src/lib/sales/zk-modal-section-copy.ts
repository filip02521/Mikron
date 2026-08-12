/** Nagłówki sekcji modalu szczegółów ZK. */
export const ZK_MODAL_SECTION_TITLES = {
  prosba: "Powiązane prośby",
  note: "Notatka do sprawy",
  details: "Szczegóły",
  lines: "Lista towaru",
  teeth: "Zęby — listy i status",
} as const;

/** Podpowiedzi (?) sekcji modalu szczegółów ZK. */
export const ZK_MODAL_SECTION_HINTS = {
  prosba:
    "Prośby klienta do pozycji z tego ZK — aktywne u góry, zrealizowane zostają w podglądzie (m.in. dla ilości zamówionej vs ZK).",
  note: "Notatka u Ciebie domyślnie prywatna. Włącz „Dołącz do prośby”, żeby zakupy widziały ją w prośbie — status mówi, czy jest dołączona, a zapis zmian aktualizuje też otwarte prośby.",
  details: "Dane klienta i ZK zsynchronizowane z Subiekta.",
  lines:
    "Postęp realizacji wybranych pozycji. Domyślnie widać zakres z konfiguracji ZK — pełną listę z Subiekta rozwiniesz przyciskiem w sekcji.",
  teeth:
    "Szkice list zębów przygotowane do prośby oraz status zamówień zębowych powiązanych z tym ZK.",
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
