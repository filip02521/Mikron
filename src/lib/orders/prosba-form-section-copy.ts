/** Nagłówki i podpowiedzi sekcji formularza „Nowa prośba” (handlowiec). */
export const PROSBA_FORM_SECTION_COPY = {
  delegate: {
    title: "W czyim imieniu?",
    hint: "Kierownik składa prośbę za wybranego handlowca — po wysłaniu trafi do jego listy „Moje zamówienia”.",
  },
  requestKind: {
    title: "Co chcesz zgłosić?",
    hint: "Zamówienie u dostawcy albo informacja o dostępności — pola niżej dopasują się do wyboru.",
  },
  products: {
    title: "Produkty",
    orderHint:
      "Nazwa, symbol lub kod z Subiekta oraz ilość. Dostawcę dopasujemy automatycznie — notatkę możesz dodać przy każdej pozycji.",
    /** Edycja prośby handlowca — bez osobnego akapitu o dostawcy. */
    salesEditHint:
      "Symbol, kod Mikran lub opis oraz ilość. Dostawcę dopasujemy z Subiekta po zapisie albo uzupełni dział zakupów.",
    procurementEditHint:
      "Symbol, kod Mikran lub opis, ilość oraz opcjonalnie klient końcowy (Subiekt) przy każdej pozycji.",
  },
  delegateProcurement: {
    title: "Dla kogo i u kogo?",
    hint: "Handlowiec, którego dotyczy prośba, oraz dostawca — widoczne w panelu dziennym i przy zamówieniu.",
  },
} as const;
