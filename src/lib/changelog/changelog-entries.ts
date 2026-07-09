export type ChangelogCategory = "new" | "improvement" | "fix";
export type ChangelogAudience = "all" | "sales" | "operations" | "teeth" | "admin";

export type ChangelogEntry = {
  id: string;
  version: string;
  date: string;
  category: ChangelogCategory;
  audience: ChangelogAudience;
  title: string;
  description: string;
  /** Ważna zmiana — większy tytuł, akcentowane tło, większy padding. */
  highlight?: boolean;
  /** Drobna zmiana — mniejszy tytuł, mniej paddingu, subtelsze tło. */
  minor?: boolean;
  link?: {
    href: string;
    label: string;
  };
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  // ═══ WAŻNE ZMIANY (highlight) ═══
  {
    id: "2026-07-09-teeth-panel",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    highlight: true,
    title: "Nowy panel zębów z kolejką zamówień",
    description:
      "Dodaliśmy dedykowany panel do zarządzania zamówieniami na zęby. Możesz tam przeglądać kolejkę, sprawdzać gotowość zamówień i filtrować po statusie i dostawcy.",
    link: { href: "/zeby/kolejka", label: "Przejdź do kolejki zębów" },
  },
  {
    id: "2026-07-09-teeth-receive",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    highlight: true,
    title: "Panel przyjmowania zębów",
    description:
      "Nowa sekcja do przyjmowania dostaw zębów. Pokazuje, ile sztuk dotarło, pozwala oznaczać linie jako zrealizowane i generuje podsumowanie przyjęcia.",
    link: { href: "/zeby/przyjecie", label: "Przejdź do przyjmowania" },
  },
  {
    id: "2026-07-09-magazyn-workspace",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "operations",
    highlight: true,
    title: "Nowy obszar magazynu",
    description:
      "Dodaliśmy dedykowany obszar dla magazynu z własną nawigacją i widokami dostosowanymi do pracy magazyniera — przyjmowanie dostaw i stan magazynu.",
  },
  {
    id: "2026-07-09-sales-vacations",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    highlight: true,
    title: "Urlopy i zastępstwa handlowców",
    description:
      "Handlowcy mogą teraz samodzielnie ustalać swoje okresy urlopów w Ustawieniach, a kierownicy zarządzają urlopami całego zespołu przez kalendarz w sekcji Zespół. Podczas urlopu system automatycznie wskazuje wyznaczonego zastępcę — zastępca widzi panel nieobecnego handlowca przez przełącznik na górze strony „Moje” i może potwierdzać odbiory oraz zamykać sprawy ZK. Edycja i anulowanie zamówień pozostają zablokowane dla zastępcy.",
    link: { href: "/ustawienia", label: "Przejdź do Ustawień" },
  },
  {
    id: "2026-07-09-sales-inbox-bell",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    highlight: true,
    title: "Globalny dzwonek z pilnymi sprawami",
    description:
      "Na górze ekranu pojawił się dzwonek, który pokazuje liczbę pilnych spraw. Po kliknięciu otwiera się panel z listą oczekujących powiadomień — nie musisz już sprawdzać każdej zakładki osobno.",
  },
  {
    id: "2026-07-09-unified-toasts",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "all",
    highlight: true,
    title: "Ujednolicone powiadomienia toast",
    description:
      "Wszystkie komunikaty w systemie (sukces, błąd, ostrzeżenie) wyglądają teraz spójnie i pojawiają się w tym samym miejscu na ekranie. Dodatkowo powiadomienia o nowych sprawach mają dźwięk.",
  },

  // ═══ ZMIANY STANDARDOWE ═══
  {
    id: "2026-07-09-moje-search-bar",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    title: "Wyszukiwarka na stronach „Moje”",
    description:
      "Dodaliśmy pasek wyszukiwania na stronach „Moje zamówienia” i „Moje prośby”. Możesz szybko znaleźć zamówienie po numerze, kliencie lub produkcie bez przewijania listy.",
    link: { href: "/moje", label: "Przejdź do Moje" },
  },
  {
    id: "2026-07-09-moje-delegate-switcher",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    title: "Przełącznik zastępstw na „Moje”",
    description:
      "Jeśli zastępujesz nieobecnego handlowca, na górze strony „Moje” pojawi się pasek z informacją o aktywnym zastępstwie i przyciskiem przełączenia do jego panelu. Przy wielu zastępstwach możesz wybrać konkretnego handlowca z listy. Przycisk „Wróć do mojego panelu” przywraca Twój własny widok.",
  },
  {
    id: "2026-07-09-moje-request-progress",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    title: "Pasek postępu prośby na „Moje”",
    description:
      "Przy każdej prośbie na „Moje” pokazuje się teraz pasek postępu — ile linii jest zamówionych, ile dostarczonych i ile jeszcze czeka. Na pierwszy rzut oka widać, jak daleko jest realizacja.",
  },
  {
    id: "2026-07-09-warehouse-carriers",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "operations",
    title: "Modal przewoźników magazynu",
    description:
      "Dodaliśmy okno do zarządzania przewoźnikami w sekcji magazynu. Możesz tam sprawdzić i zaktualizować informacje o przewoźnikach przypisanych do dostaw.",
  },
  {
    id: "2026-07-09-warehouse-inventory",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "operations",
    title: "Sekcja stanu magazynu",
    description:
      "W kolejce przyjmowania dodaliśmy sekcję pokazującą aktualny stan magazynu dla poszczególnych produktów — bez konieczności przechodzenia do osobnej strony.",
  },
  {
    id: "2026-07-09-receive-queue-selection-bar",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    title: "Pasek zaznaczania w kolejce przyjmowania",
    description:
      "W kolejce przyjmowania towaru dodaliśmy pasek akcji zbiorczych — możesz zaznaczyć wiele linii i jednocześnie potwierdzić ich przyjęcie, zamiast robić to linia po linii.",
  },
  {
    id: "2026-07-09-teeth-ocr",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "OCR zębów ze zdjęć",
    description:
      "Dodaliśmy możliwość rozpoznawania zębów ze zdjęć za pomocą OCR. System automatycznie sugeruje dopasowanie formy zębowej na podstawie zdjęcia zamówienia.",
  },
  {
    id: "2026-07-09-teeth-products-admin",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "admin",
    title: "Panel produktów zębowych dla admina",
    description:
      "Dodaliśmy panel do zarządzania produktami zębowymi w sekcji admina. Możesz tam dodawać, edytować i usuwać produkty zębowe oraz przypisywać je do dostawców.",
  },
  {
    id: "2026-07-09-inactive-suppliers-admin",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "admin",
    title: "Zarządzanie nieaktywnymi dostawcami",
    description:
      "Dodaliśmy panel do zarządzania nieaktywnymi dostawcami w sekcji admina. Możesz tam oznaczać dostawców jako nieaktywnych i ukrywać ich z panelu dziennego.",
  },
  {
    id: "2026-07-09-vacations-admin",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "admin",
    title: "Panel urlopów w sekcji admina",
    description:
      "Dodaliśmy panel do zarządzania urlopami handlowców w sekcji admina. Możesz tam definiować okresy urlopów i przypisywać delegatów na czas nieobecności.",
  },
  {
    id: "2026-07-09-teeth-verification",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Weryfikacja zębów w jednej linii",
    description:
      "Dodaliśmy widok weryfikacji, w którym możesz dodawać i sprawdzać pozycje zębowe bezpośrednio w tabeli — bez otwierania osobnych okien.",
    link: { href: "/zeby/weryfikacja", label: "Przejdź do weryfikacji" },
  },
  {
    id: "2026-07-09-teeth-schedule",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Harmonogram dostaw zębów",
    description:
      "Nowa strona z harmonogramem pokazuje planowane daty dostaw zębów od poszczególnych dostawców, co ułatwia planowanie pracy.",
    link: { href: "/zeby/harmonogram", label: "Przejdź do harmonogramu" },
  },
  {
    id: "2026-07-09-teeth-warehouse-status",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Status magazynu zębów",
    description:
      "Nowa strona pokazuje aktualny stan zębów w magazynie — ile sztuk jest dostępnych i które linie wymagają uzupełnienia.",
    link: { href: "/zeby/status-magazynu", label: "Przejdź do statusu magazynu" },
  },
  {
    id: "2026-07-09-teeth-history",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Historia zamówień zębów",
    description:
      "Dodaliśmy stronę z pełną historią zamówień na zęby. Możesz sprawdzić, kto i kiedy zmieniał status zamówienia.",
    link: { href: "/zeby/historia", label: "Przejdź do historii" },
  },
  {
    id: "2026-07-09-teeth-mould-catalogs",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Katalogi form zębów",
    description:
      "Dodaliśmy katalogi form zębowych dla wszystkich producentów (Ivoclar, Dentex, Major, Wiedent) z wyszukiwaniem po kształcie. Ułatwia to dobór odpowiedniego zęba przy tworzeniu zamówienia.",
  },
  {
    id: "2026-07-09-teeth-detail-dialog",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "sales",
    title: "Szczegóły zamówienia zęba dla handlowca",
    description:
      "Handlowcy mogą teraz kliknąć zamówienie zęba na liście, aby zobaczyć jego szczegóły w oknie — bez przechodzenia do panelu zębów. Okno pokazuje kolor, wzór, rozmiar, szczękę, typ oraz status każdej pozycji zębowej.",
  },
  {
    id: "2026-07-09-moje-teeth-pickup-icons",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    minor: true,
    title: "Ikony na przyciskach odbioru zębów",
    description:
      "Przyciski potwierdzenia odbioru na „Moje” mają teraz ikony: ząb dla zamówień zębowych i paczka dla towaru z regału. Przy zamówieniach mieszanych (zęby + towar) przyciski są podzielone i oznaczone osobno, co ułatwia potwierdzenie właściwego odbioru.",
  },
  {
    id: "2026-07-09-teeth-handover-inbox",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Skrzynka przekazań zębów",
    description:
      "Nowa skrzynka pokazuje zęby przekazane między działami. Możesz szybko sprawdzić, co czeka na odbiór i potwierdzić przejęcie.",
  },
  {
    id: "2026-07-09-teeth-partial-delivery",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    title: "Częściowe dostawy zębów",
    description:
      "Zamówienia na zęby mogą teraz być realizowane częściowo. Jeśli dostawca wyśle tylko część zamówienia, możesz to oznaczyć, a reszta zostanie w kolejce.",
  },
  {
    id: "2026-07-09-moje-visual-overhaul",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    highlight: true,
    title: "Odświeżony wygląd stron „Moje”",
    description:
      "Zmodernizowaliśmy wygląd kart zamówień i próśb na stronach „Moje” — ujednolicone style odznak (zaokrąglenia, kolory, obrysy), ikony na przyciskach potwierdzenia odbioru (ikona zęba dla zamówień zębowych, ikona paczki dla towaru z regału), spójne metadane dostaw oraz czytelniejsze puste stany z ikonami. Karty mają teraz delikatne cienie, zaokrąglone rogi i efekty najechania.",
    link: { href: "/moje", label: "Przejdź do Moje" },
  },
  {
    id: "2026-07-09-moje-compact-ui",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    title: "Czytelniejsze strony „Moje”",
    description:
      "Przebudowaliśmy układ stron „Moje zamówienia” i „Moje prośby” — są teraz bardziej kompaktowe, z możliwością rozwijania i zwijania sekcji oraz płynną animacją.",
    link: { href: "/moje", label: "Przejdź do Moje" },
  },
  {
    id: "2026-07-09-sales-vacation-periods",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "admin",
    title: "Kalendarz urlopów zespołu",
    description:
      "Kierownicy mogą zarządzać urlopami i zastępstwami przez kalendarz w sekcji Zespół. Widzą wszystkie okresy urlopów na jednym widoku i mogą wyznaczać zastępców bezpośrednio z kalendarza.",
    link: { href: "/zespol/urlopy", label: "Przejdź do urlopów zespołu" },
  },
  {
    id: "2026-07-09-tablica-mixed-lanes",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    title: "Tablica obsługuje zamówienia mieszane",
    description:
      "Tablica działu zakupów potrafi teraz wyświetlać zamówienia mieszane (zęby + produkty) w dedykowanych pasach, co ułatwia ich obsługę i nie wymaga przełączania między widokami.",
    link: { href: "/tablica", label: "Przejdź do tablicy" },
  },
  {
    id: "2026-07-09-mobile-ui-fixes",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "all",
    title: "Ulepszenia interfejsu na telefonach",
    description:
      "Poprawiliśmy odstępy, rozmiary przycisków i widoczność elementów na ekranach telefonów w czterech obszarach systemu: panel dzienny, tablica, Moje i panel zębów.",
  },
  {
    id: "2026-07-09-teeth-audit-fixes",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "teeth",
    title: "Stabilność panelu zębów",
    description:
      "Naprawiliśmy serię błędów w panelu zębów: zabezpieczenie przed podwójnym cofaniem operacji, szybsze ładowanie kolejki i stabilniejsze aktualizacje statusów.",
  },

  // ═══ DROBNE ZMIANY (minor) ═══
  {
    id: "2026-07-09-teeth-help-page",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "teeth",
    minor: true,
    title: "Strona pomocy panelu zębów",
    description:
      "Dodaliśmy stronę z wyjaśnieniem, jak działa panel zębów — od tworzenia zamówienia po przyjmowanie dostawy.",
    link: { href: "/zeby/pomoc", label: "Przejdź do pomocy" },
  },
  {
    id: "2026-07-09-tablica-filters",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    minor: true,
    title: "Lepsze filtry na tablicy",
    description:
      "Ulepszyliśmy filtry na tablicy — można teraz szybciej zawężać widok po statusie i typie zamówienia. Dodaliśmy też czytelniejsze chipy filtrów dostawców.",
  },
  {
    id: "2026-07-09-panel-hidden-suppliers",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    minor: true,
    title: "Ukrywanie dostawców na panelu dziennym",
    description:
      "Dodaliśmy możliwość ukrywania nieaktywnych dostawców na panelu dziennym, żeby skupić się na tych, którzy mają bieżące zamówienia.",
  },
  {
    id: "2026-07-09-zk-watch-visual-overhaul",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    minor: true,
    title: "Odświeżony wygląd sekcji „ZK czekające”",
    description:
      "Zmodernizowaliśmy karty obserwowanych ZK w notatniku — ujednolicone odznaki, ikony na przyciskach akcji prośby, nowoczesne nagłówki grup miesięcznych i czytelniejsze puste stany z ikoną wyszukiwania. Podgląd zębów w ZK oraz modal zamykania sprawy otrzymały spójne style odznak.",
  },
  {
    id: "2026-07-09-notatnik-zk-watch-teeth",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "all",
    minor: true,
    title: "Podgląd zębów w obserwowanych ZK",
    description:
      "W notatniku, przy obserwowanych zamówieniach ZK, dodaliśmy podgląd pozycji zębowych. Możesz szybko sprawdzić, jakie zęby są w zamówieniu, bez otwierania panelu zębów.",
  },
  {
    id: "2026-07-09-undo-toasts",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "new",
    audience: "all",
    minor: true,
    title: "Przycisk „Cofnij” w powiadomieniach",
    description:
      "Wybrane powiadomienia (np. o wysłaniu e-maila) mają teraz przycisk „Cofnij”, który pozwala jednym kliknięciem odwrócić akcję.",
  },
  {
    id: "2026-07-09-terminy-sortable",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "all",
    minor: true,
    title: "Sortowanie kolumn w Terminach zamówień",
    description:
      "Przywróciliśmy możliwość sortowania po kolumnach w tabeli Terminy zamówień — można ponownie sortować po dacie, statusie i innych polach.",
  },
  {
    id: "2026-07-09-delivery-email-undo",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "operations",
    minor: true,
    title: "Cofanie e-maili dostawy",
    description:
      "Naprawiliśmy problem z cofaniem wysłanych e-maili o dostawie — operacja działa teraz stabilnie i nie zostawia wiszących wiadomości.",
  },
  {
    id: "2026-07-09-ivostar-recognition",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "teeth",
    minor: true,
    title: "Lepsze rozpoznawanie zębów Ivostar Chromascop",
    description:
      "Ulepszyliśmy rozpoznawanie zębów producenta Ivostar Chromascop oraz dodaliśmy wsparcie dla podwójnego rodzaju zębów Ivoclar (np. Vivodent + Orthotyp).",
  },
  {
    id: "2026-07-09-catalog-sync-fix",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "all",
    minor: true,
    title: "Naprawa synchronizacji katalogu z Subiektem",
    description:
      "Naprawiliśmy błąd, przez który data synchronizacji katalogu nie odświeżała się przy kontynuacji nocnego synchronizowania. Teraz data zawsze pokazuje ostatnie uruchomienie.",
  },
  {
    id: "2026-07-09-subiekt-teeth-link",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "sales",
    minor: true,
    title: "Wyświetlanie linku do Subiekta przy zębach",
    description:
      "Naprawiliśmy problem z wyświetlaniem linku do produktu w Subiekcie przy zamówieniach zawierających zęby — link pojawia się teraz poprawnie.",
  },
  {
    id: "2026-07-09-sales-cancel-disposition",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    minor: true,
    title: "Formularz dyspozycji anulowania na panelu dziennym",
    description:
      "Dodaliśmy formularz dyspozycji anulowania zamówienia bezpośrednio na panelu dziennym handlowca — nie trzeba przechodzić do osobnej strony.",
  },
  {
    id: "2026-07-09-quick-order-modal",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    minor: true,
    title: "Ulepszony modal szybkiego zamówienia",
    description:
      "Ulepszyliśmy okno szybkiego zamówienia na panelu dziennym — czytelniejszy układ i szybsze wprowadzanie danych.",
  },
  {
    id: "2026-07-09-notatnik-rich-editor",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "sales",
    minor: true,
    title: "Bogatszy edytor notatek",
    description:
      "Ulepszyliśmy edytor notatek w notatniku handlowca — dodaliśmy pasek narzędzi formatowania i lepsze wyświetlanie treści.",
  },
  {
    id: "2026-07-09-operations-notepad",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "improvement",
    audience: "operations",
    minor: true,
    title: "Ulepszenia notatnika operacyjnego",
    description:
      "Ulepszyliśmy notatnik dla działu operacji — czytelniejszy układ i lepsze zarządzanie sekcjami notatek.",
  },
  {
    id: "2026-07-09-apple-icon",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "all",
    minor: true,
    title: "Ikona aplikacji na ekranie głównym iPhone",
    description:
      "Dodaliśmy dedykowaną ikonę aplikacji, która wyświetla się po dodaniu strony do ekranu głównego na iPhone.",
  },
  {
    id: "2026-07-09-crypto-polyfill",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "all",
    minor: true,
    title: "Naprawa działania na starszych przeglądarkach",
    description:
      "Dodaliśmy polyfill dla kryptografii, co naprawia problemy z logowaniem na starszych przeglądarkach, które nie obsługują Web Crypto API.",
  },
  {
    id: "2026-07-09-error-page",
    version: "2026-07-09",
    date: "2026-07-09",
    category: "fix",
    audience: "all",
    minor: true,
    title: "Ulepszona strona błędu",
    description:
      "Ulepszyliśmy stronę błędu — pokazuje teraz czytelny komunikat zamiast białego ekranu, gdy coś pójdzie nie tak.",
  },
];

export const CHANGELOG_LATEST_VERSION =
  CHANGELOG_ENTRIES.length > 0 ? CHANGELOG_ENTRIES[0]!.version : "0.0.0";

export const CHANGELOG_CATEGORY_META: Record<
  ChangelogCategory,
  { label: string; badgeClass: string; dotClass: string }
> = {
  new: {
    label: "Nowość",
    badgeClass: "bg-emerald-100 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  improvement: {
    label: "Ulepszenie",
    badgeClass: "bg-indigo-100 text-indigo-800",
    dotClass: "bg-indigo-500",
  },
  fix: {
    label: "Naprawa",
    badgeClass: "bg-amber-100 text-amber-800",
    dotClass: "bg-amber-500",
  },
};
