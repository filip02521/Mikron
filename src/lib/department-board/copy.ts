import { DEPARTMENT_BOARD_SUCCESS_TOAST } from "@/lib/ui/notice-copy";

export const DEPARTMENT_BOARD_SALES_PAGE_TITLE = "Pytania zespołu";
export const DEPARTMENT_BOARD_SALES_PAGE_DESC =
  "Wspólne pytania i odpowiedzi z działem zakupów. Ogłoszenia od zakupów znajdziesz w Moje zamówienia. Możesz doprecyzować pytanie lub zamknąć wątek, gdy uzyskasz odpowiedź. Wątki bez aktywności przez 2 dni po odpowiedzi zakupów zamykają się automatycznie.";

export const DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE = "Tablica";
export const DEPARTMENT_BOARD_PROCUREMENT_PAGE_DESC =
  "Ogłoszenia dla handlowców (jednokierunkowo) oraz pytania zespołu sprzedaży z odpowiedziami widocznymi dla wszystkich. Handlowcy mogą doprecyzować pytania i zamykać wątki.";

export const DEPARTMENT_BOARD_ANNOUNCEMENTS_EXPLAINER = {
  title: "Ogłoszenia od zakupów",
  body: "Komunikaty do odczytu. Pytania zadajesz na Tablicy.",
};

export const DEPARTMENT_BOARD_QUESTIONS_EXPLAINER = {
  title: "Pytania do zakupów",
  body: "Widoczne dla całego działu.",
};

export const DEPARTMENT_BOARD_QUESTIONS_FORM = {
  title: "Zadaj pytanie",
  titlePlaceholder: "Np. termin dostawy",
  bodyPlaceholder: "Szczegóły pytania…",
  titleLabel: "Temat",
  bodyLabel: "Treść",
  productLabel: "Produkt (opcjonalnie)",
  productPlaceholder: "Symbol, nazwa lub kod Mikran",
  productLinked: "Wybrano z Subiekta",
  productSelected: "Wybrano",
  productRemove: "Usuń",
  productChange: "Zmień",
  productContextLabel: "Produkt",
  productSearchLoading: "Szukam…",
  submit: "Wyślij",
  submitting: "Wysyłanie…",
  successToast: DEPARTMENT_BOARD_SUCCESS_TOAST,
  introBeforeLink: "Zamówienie towaru —",
  introLinkLabel: "Nowa prośba",
  expandHint: "Rozwiń",
  imagesLabel: "Zdjęcia (opcjonalnie)",
  imagesHint: "Do 3 zdjęć — np. etykieta, opakowanie lub zrzut z Subiekta.",
  imagesAdd: "Dodaj zdjęcie",
  imagesAddMore: "Dodaj kolejne",
  imagesCompressing: "Przetwarzanie zdjęć…",
  imagesTooMany: "Możesz dodać maksymalnie 3 zdjęcia.",
  quickProsbaHint:
    "Pytanie na Tablicy nie zamawia towaru. Żeby go zamówić, złóż prośbę.",
  quickProsbaCta: "Szybka prośba",
  quickProsbaPrefillNotice:
    "Uzupełniono produkt z pytania na Tablicy. Podaj ilość i dokończ prośbę.",
};

export const DEPARTMENT_BOARD_QUESTIONS_FILTERS = {
  focusDisabledHint:
    "Filtry są tymczasowo zablokowane — otworzyłeś konkretny wątek z linku.",
  toolbarLabel: "Filtruj listę",
  /** Krótka etykieta grupy statusu (sales). */
  statusGroupLabel: "Status",
  /** Krótka etykieta grupy uwagi handlowca. */
  attentionGroupLabel: "Dla Ciebie",
  /** Gdy filtr own_unseen z URL / inbox bez chipa w UI. */
  ownUnseenActiveHint: "Widok: Twoje pytania z nową odpowiedzią.",
  ownUnseenClearLabel: "Pokaż wszystkie",
  toolbarHint:
    "Zawęż listę według statusu lub zakresu. Liczby przy filtrach zależą od wyszukiwania.",
  searchHint:
    "Szukaj po temacie, treści pytania, produkcie, autorze lub fragmencie odpowiedzi zakupów.",
  labels: {
    all: "Aktywne",
    open: "Czekają",
    answered: "Z odpowiedzią",
    closed: "Zakończone",
    unseen: "Nowe",
    own_unseen: "Moje nowe",
    mine: "Moje",
  },
  chips: {
    all: "Aktywne pytania zespołu — bez zakończonych.",
    open: "Czekają na odpowiedź działu zakupów.",
    answered: "Mają już odpowiedź zakupów.",
    closed: "Zakończone przez handlowca lub zakupy.",
    unseen: "Nowe odpowiedzi zakupów, których jeszcze nie otworzyłeś.",
    own_unseen: "Twoje pytania z nową odpowiedzią, której jeszcze nie otworzyłeś.",
    mine: "Tylko pytania złożone przez Ciebie.",
  },
};

export const DEPARTMENT_BOARD_ANNOUNCEMENTS_SEARCH = {
  label: "Szukaj w ogłoszeniach",
  placeholder: "Tytuł, treść lub autor ogłoszenia",
};

export const DEPARTMENT_BOARD_NOTES_DISTINCTION_SALES =
  "To nie jest ZK czekające (Twoje zamówienia z Subiekta) ani wewnętrzne notatki zakupów — tu rozmawiacie z działem zakupów.";

export const DEPARTMENT_BOARD_NOTES_DISTINCTION_PROCUREMENT =
  "Wewnętrzne notatki działu (prywatne/wspólne) nadal są w Notatki — ta strona dotyczy komunikacji z handlowcami.";

export function departmentBoardOpenQuestionsLabel(count: number): string {
  if (count <= 0) return "";
  if (count === 1) return "1 otwarte pytanie na tablicy";
  if (count >= 2 && count < 5) return `${count} otwarte pytania na tablicy`;
  return `${count} otwartych pytań na tablicy`;
}

export const DEPARTMENT_BOARD_PROCUREMENT_OPEN_QUESTIONS_HINT =
  "Handlowcy czekają na odpowiedź działu zakupów.";
