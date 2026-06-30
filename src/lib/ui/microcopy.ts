/**
 * Wspólne komunikaty UI — spójny ton: krótko, po polsku, czasowniki w CTA.
 */

export const MICROCOPY = {
  actions: {
    refresh: "Odśwież teraz",
    readMore: "Czytaj",
    submitRequest: "Zgłoś prośbę",
    help: "Pomoc",
    save: "Zapisz",
    cancel: "Anuluj",
    confirm: "Potwierdź",
    back: "Wstecz",
    next: "Dalej",
  },
  empty: {
    orders: {
      title: "Brak aktywnych prośb",
      description:
        "Gdy zgłosisz prośbę lub zakupy ją przetworzą, status pojawi się tutaj.",
    },
    queue: {
      title: "Kolejka przyjęcia jest pusta",
      description:
        "Tu trafiają zamówienia złożone u dostawcy oraz prośby informacyjne. Wpisz ilość dostawy lub powiadom handlowca o informacji.",
      filterTitle: "Brak pozycji dla wybranego dostawcy",
      filterDescription: "Wybierz innego dostawcę lub pokaż całą kolejkę.",
    },
    history: {
      title: "Brak wpisów w historii",
      description: "Zrealizowane i zarchiwizowane prośby pojawią się po czasie.",
      individualTitle: "Brak wpisów w historii indywidualnej",
      standardTitle: "Brak historii zamówień standardowych",
    },
    search: {
      title: "Brak wyników",
      description: "Spróbuj innej frazy lub wyczyść filtry.",
    },
  },
  errors: {
    generic: "Coś poszło nie tak — spróbuj ponownie za chwilę.",
    loadFailed: "Nie udało się załadować danych. Odśwież stronę.",
    saveFailed: "Nie udało się zapisać zmian. Sprawdź połączenie i spróbuj jeszcze raz.",
    unauthorized: "Brak uprawnień do tej operacji.",
    sessionExpired: "Sesja wygasła — zaloguj się ponownie.",
  },
  notices: {
    boardHint:
      "Komunikat od zakupów — nie prośba o towar. Status zamówień sprawdzasz w Moje zamówienia.",
    updatesAvailable:
      "Status, termin lub dostawa mogły się zmienić — odśwież widok, aby zobaczyć aktualny stan.",
    operationsUpdates:
      "Handlowiec mógł dodać prośbę albo zmienić się kolejka — odśwież widok, aby zobaczyć aktualny stan.",
    operationsQueueChanged: "Kolejka się zmieniła — odśwież, aby zobaczyć nowe prośby.",
    teethUpdates:
      "Kolejka zamówień na zęby uległa zmianie — odśwież widok, aby zobaczyć aktualny stan.",
  },
} as const;
