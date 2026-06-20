/** Podpowiedzi nagłówków kart — dymek ? przy tytule. */
export const SALES_PAGE_HEADER_HINTS = {
  moje: "Tu śledzisz swoje prośby — co jest do odbioru, co czeka u dostawcy i co obserwujemy na magazynie.",
  plan: "Harmonogram zamówień u dostawców powiązanych z Twoimi prośbami — terminy i wyszukiwarka.",
  planProcurement:
    "Pełny harmonogram zakupów na ten tydzień — podgląd terminów u wszystkich dostawców.",
  tablica:
    "Ogłoszenia zespołu i pytania do działu zakupów. Notatki z notatnika są prywatne — nie pojawiają się tutaj.",
  teamOverview:
    "Karty handlowców z Twoich grup — prośby, ZK czekające na towar i prywatny notatnik w jednym miejscu.",
  teamHandlowcy:
    "Dodawanie osób, przypisanie do grupy, konta logowania, hasła startowe i linki zaproszenia.",
  teamGroups: "Grupy sortują listę handlowców w podglądzie kierownika.",
  operationsNotepad:
    "Notatki operacyjne działu — widoczne w zespole zakupów i magazynu, inne niż prywatny notatnik handlowca.",
  dailyPanel:
    "Kolejka zakupów — prośby handlowców na dziś, plan tygodnia i wyjątki poza harmonogramem.",
  verification:
    "Niekompletne prośby handlowców — uzupełnij dostawcę i produkt. Po zatwierdzeniu trafiają do panelu dziennego; ścieżka informacji jest zachowana.",
  queue:
    "Jedna lista przyjęcia: zamówienia i informacje u tego samego dostawcy — kolejka, dziennik i inwentaryzacja regału.",
  prosba: "Zgłoś prośbę do działu zakupów — pojedynczą lub grupową, z opcjonalnymi notatkami i klientem.",
  accountLink:
    "Aby korzystać z aplikacji jako handlowiec, konto musi być przypisane do Twojego profilu w systemie.",
  zk: "Zamówienia klientów (ZK) z Subiekta — prośby do zakupów, magazyn i przypomnienia. Zamknięte sprawy są w zakładce Archiwum.",
} as const;

export function salesHistoriaHeaderHint(months: number, previewCount: number): string {
  return `Audyt zamówień z ostatnich ${months} miesięcy. Na liście — ${previewCount} najnowszych wpisów w każdej sekcji; resztę otworzysz z wyszukiwaniem.`;
}

export const SALES_SEARCH_COPY = {
  moje: "Szukaj po produkcie, dostawcy, kliencie, symbolu lub kodzie PLU",
  zkList: "Klient, numer ZK lub produkt na Twojej liście",
  planSupplier: "Fragment nazwy dostawcy w harmonogramie",
  planProcurementSupplier: "Nazwa dostawcy w harmonogramie zakupów",
  boardQuestions: "Temat, treść, autor lub fragment odpowiedzi",
  archiveZk: "Klient, numer ZK lub produkt w archiwum",
  archiveNotes: "Tytuł lub treść w archiwum notatek",
  operationsNotes: "Tytuł lub treść notatki operacyjnej",
} as const;
