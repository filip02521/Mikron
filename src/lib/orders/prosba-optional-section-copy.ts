/** Teksty zwijanych sekcji opcjonalnych w formularzu prośby. */
export const PROSBA_OPTIONAL_SECTION_COPY = {
  lineNote: {
    title: "Notatka do tej pozycji",
    description: "Kontekst dla zakupów — termin, pilność, ustalenia z klientem",
    copyToAllLines: "Skopiuj notatkę na wszystkie pozycje",
  },
  client: {
    title: "Klient końcowy",
    description: "Dla kogo zamawiamy — z podpowiedzi Subiekta",
  },
  readiness: {
    title: "Co jeszcze do uzupełnienia?",
  },
  keyboard: {
    title: "Skróty klawiszowe",
    description: "Rodzaj prośby, kolejny produkt, wybór z Subiekta, wysyłka",
  },
} as const;

/** Podpowiedzi nagłówków karty / modala formularza prośby (ikona ? przy tytule). */
export const PROSBA_PAGE_HEADER_HINTS = {
  newRequest:
    "Formalne zgłoszenie do działu zakupów. Po wysłaniu status i kolejne kroki zobaczysz w Moje zamówienia.",
  groupOrder:
    "Wiele produktów w jednej lub kilku grupach — w każdej grupie jeden dostawca i jeden handlowiec.",
  groupCard:
    "Produkty w tej grupie trafiają do tego samego dostawcy. Uzupełnij listę i wyślij grupę osobno.",
  editSales:
    "Możesz poprawić prośbę, dopóki dział zakupów nie oznaczy jej jako zamówionej u dostawcy.",
  editProcurement:
    "Korekta przed złożeniem zamówienia u dostawcy — np. zły dostawca, opis produktu lub ilość.",
  dailyNewRequest:
    "Prośba handlowca w imieniu wybranej osoby — po zapisie pojawi się w panelu dziennym.",
} as const;
