import { DEPARTMENT_BOARD_SUCCESS_TOAST } from "@/lib/ui/notice-copy";

export const DEPARTMENT_BOARD_SALES_PAGE_TITLE = "Pytania zespołu";
export const DEPARTMENT_BOARD_SALES_PAGE_DESC =
  "Wspólne pytania i odpowiedzi z działem zakupów. Ogłoszenia od zakupów znajdziesz w Moje zamówienia.";

export const DEPARTMENT_BOARD_PROCUREMENT_PAGE_TITLE = "Tablica";
export const DEPARTMENT_BOARD_PROCUREMENT_PAGE_DESC =
  "Ogłoszenia dla handlowców (jednokierunkowo) oraz pytania zespołu sprzedaży z odpowiedziami widocznymi dla wszystkich.";

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
};

export const DEPARTMENT_BOARD_QUESTIONS_FILTERS = {
  focusDisabledHint:
    "Filtry są tymczasowo zablokowane — otworzyłeś konkretny wątek z linku.",
  toolbarLabel: "Filtruj listę",
  toolbarHint:
    "Zawęż wątki według statusu. Liczby przy chipach pokazują wynik w obrębie aktywnego filtra i wyszukiwania.",
  searchHint:
    "Szukaj po temacie, treści pytania, produkcie, autorze lub fragmencie odpowiedzi zakupów.",
  chips: {
    all: "Wszystkie aktywne pytania na tablicy.",
    open: "Pytania bez odpowiedzi działu zakupów.",
    answered: "Pytania z co najmniej jedną odpowiedzią zakupów.",
    unseen: "Odpowiedzi zakupów, których jeszcze nie otworzyłeś.",
    own_unseen: "Twoje pytania z nową odpowiedzią zakupów, której jeszcze nie otworzyłeś.",
    mine: "Pytania złożone przez Ciebie (powiązane z Twoim profilem handlowca).",
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
