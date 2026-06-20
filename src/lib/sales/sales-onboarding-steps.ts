import type { NavIconKey } from "@/components/icons/NavIcon";
import { isSalesManager } from "@/lib/auth-roles";
import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
} from "@/lib/orders/informacja-flow-copy";
import type { UserRole } from "@/types/database";

export type SalesOnboardingStep = {
  id: string;
  navKey?: NavIconKey;
  /** Etykieta zakładki w menu — spójna z nav.ts, nie surowy URL. */
  navLabel?: string;
  href?: string;
  title: string;
  lead: string;
  bullets: string[];
  tip?: string;
};

/** Kroki touru widoczne wyłącznie dla roli sales_manager. */
export const MANAGER_ONLY_ONBOARDING_STEP_IDS = ["zespol"] as const;

export type ManagerOnlyOnboardingStepId =
  (typeof MANAGER_ONLY_ONBOARDING_STEP_IDS)[number];

export function isManagerOnlyOnboardingStep(
  stepId: string
): stepId is ManagerOnlyOnboardingStepId {
  return (MANAGER_ONLY_ONBOARDING_STEP_IDS as readonly string[]).includes(stepId);
}

export function getSalesOnboardingSteps(role: UserRole): SalesOnboardingStep[] {
  const isManager = isSalesManager(role);
  const informacjaDirect = INFORMACJA_FLOW_DIRECT.label;
  const informacjaStockOut = INFORMACJA_FLOW_STOCK_OUT.label;

  const steps: SalesOnboardingStep[] = [
    {
      id: "welcome",
      title: "Witaj w OnTime",
      lead:
        "OnTime łączy Cię z działem zakupów i magazynem. Składasz prośby, śledzisz statusy i komunikujesz się z zespołem — bez codziennej obiegówki mailowej.",
      bullets: [
        "Sześć głównych zakładek: Moje zamówienia, Nowa prośba, ZK czekające, Notatnik, Harmonogram i Tablica — ZK i Notatnik to osobne pozycje menu.",
        ...(isManager
          ? [
              "Jako kierownik zobaczysz też krok Podgląd zespołu — bez logowania na konta innych handlowców.",
            ]
          : []),
        "Status spraw zawsze w aplikacji. E-mail dostaniesz przy ważnych zdarzeniach — np. gdy towar jest na magazynie lub gotowy do odbioru.",
        "Tour przejdzie po głównych zakładkach z przykładowymi danymi. Menu będzie chwilowo wyłączone — używaj panelu „Dalej” po prawej (na telefonie — u dołu).",
        "Tour uruchamia się raz. Po zakończeniu zobaczysz swoje dane i pełną nawigację.",
      ],
    },
    {
      id: "moje",
      navKey: "myOrders",
      navLabel: "Moje zamówienia",
      href: "/moje",
      title: "Moje zamówienia",
      lead:
        "Tu sprawdzasz status prośb — co czeka u dostawcy, co możesz odebrać z magazynu i co wymaga Twojej reakcji. Sekcja Start dnia u góry zbiera pilne sprawy.",
      bullets: [
        "Jeden wiersz = jedna prośba u jednego dostawcy. Nagłówek mówi, co się dzieje.",
        "Przy wierszu widać klienta końcowego — łatwiej rozróżnisz sprawy różnych gabinetów.",
        "Sekcja „Sprawdzamy dostępność” (fiolet) to informacja o towarze bez zamówienia u dostawcy. Dostaniesz e-mail, gdy towar będzie na magazynie.",
        "Zielony przycisk oznacza Twoją akcję: potwierdź odbiór z magazynu albo zamknij powiadomienie o dostępności.",
        "Na dole strony jest archiwum zakończonych spraw.",
      ],
      tip: "Pilne sprawy są u góry w sekcji „Potwierdź odbiór z regału” — Start dnia przewinie Cię tam.",
    },
    {
      id: "prosba",
      navKey: "newRequest",
      navLabel: "Nowa prośba",
      href: "/prosba",
      title: "Nowa prośba",
      lead:
        "Tu zgłaszasz potrzebę do zakupów: zamówienie u dostawcy albo informację o dostępności towaru. To nie to samo co pytanie na Tablicy.",
      bullets: [
        "Na górze wybierz rodzaj: Zamówienie u dostawcy albo Informacja o towarze.",
        `Przy informacji: „${informacjaDirect}” (e-mail do Ciebie + wpis w „Moje zamówienia”) albo „${informacjaStockOut}” (tylko sygnał dla zakupów — bez wpisu u Ciebie).`,
        "Wpisz produkt w jednym polu (nazwa lub symbol) i kod Mikran obok. Więcej pozycji dodajesz przyciskiem „+ Kolejny produkt”.",
        "Opcjonalnie wskaż klienta końcowego — wpisz kilka liter i wybierz z listy Subiekta albo wpisz nazwę ręcznie.",
        "Dostawcę nie wybierasz — system dopasuje go po symbolu lub kodzie. Zakupy doprecyzują, gdy trzeba.",
        "Po wysłaniu status zobaczysz w „Moje zamówienia”. Każdy dostawca ma osobny wiersz.",
        "Skrót: z karty ZK możesz wysłać prośbę — klient i produkty uzupełnią się same.",
      ],
      tip: "Im czytelniejszy opis produktu (i klient), tym rzadziej zakupy będą dopytywać.",
    },
    {
      id: "plan",
      navKey: "plan",
      navLabel: "Harmonogram",
      href: "/plan",
      title: "Harmonogram",
      lead:
        "Terminy u dostawców — pomaga zaplanować prośbę i powiedzieć klientowi, kiedy realnie można zamówić.",
      bullets: [
        "„Z otwartymi prośbami” — dostawcy z Twoich aktywnych spraw w „Moje zamówienia”. Rozwiń wiersz, aby zobaczyć szczegóły.",
        "Wyszukiwarka u góry — każdy inny dostawca z bazy firmy.",
        "„Plan działu dostaw” (pn.–pt.) to dni, w których zakupy składają zamówienia u firmy — to nie data dostawy towaru na magazyn.",
        "Warto zajrzeć przed rozmową z klientem o terminie zamówienia.",
      ],
    },
    {
      id: "tablica",
      navKey: "board",
      navLabel: "Tablica",
      href: "/tablica",
      title: "Tablica",
      lead:
        "Ogłoszenia od działu zakupów i wspólne pytania zespołu. To nie zastępuje formularza „Nowa prośba” przy zamówieniu towaru.",
      bullets: [
        "Dwie zakładki: Ogłoszenia od zakupów (tylko do odczytu) i Pytania zespołu (widoczne dla całego działu handlowego).",
        "Ogłoszenia to komunikaty od zakupów, np. zmiana procedury. Nie odpowiadasz w tej sekcji.",
        "W Pytaniach zadajesz ogólne pytanie do zakupów. W wątku widać autora, datę i odpowiedź zakupów — po odpowiedzi pojawia się oznaczenie „Odpowiedziano”.",
        "Zamówienie towaru zgłaszasz w „Nowa prośba”, nie tutaj. Status śledzisz w „Moje zamówienia”.",
        "Liczba przy zakładce w menu przypomina o nowych ogłoszeniach lub odpowiedziach na pytania.",
      ],
      tip: "Przełącz zakładki na ekranie — zobaczysz ogłoszenia i przykładowe pytania z odpowiedzią.",
    },
    {
      id: "notatnik",
      navKey: "clientZk",
      navLabel: "ZK czekające",
      href: "/zk",
      title: "ZK czekające",
      lead:
        "Tu śledzisz zamówienia klientów (ZK) z Subiekta — na co czekasz, co dotarło na magazyn i skąd wysyłasz prośbę do zakupów. Prywatny Notatnik z przypomnieniami znajdziesz osobno w menu po lewej.",
      bullets: [
        "„Do zrobienia dziś” u góry — zacznij od przypomnień ZK (notatki są w osobnym Notatniku).",
        "Zakładka „ZK” — wpisz numer ZK. System wczyta klienta i pozycje z Subiekta.",
        "Przy ZK jest „Zgłoś prośbę” — formularz wypełni się sam klientem i pozycjami.",
        "W liście pozycji chipy pokazują etap: „Na regale” (auto-zaznaczenie), „Odebrane z regału” (Moje), „Zakończone” (ręczny checkbox po odbiorze).",
        "Badge „Na regale” na karcie oznacza nowy towar czekający na odbiór. Po obejrzeniu znika z „Do zrobienia dziś”.",
        "„Notatnik” (prywatne przypomnienia) to osobna pozycja w menu — bez wysyłki do zakupów.",
        "Liczba przy „ZK czekające” w menu oznacza zaległe przypomnienia ZK (oddzielnie licznik Notatnika).",
      ],
      tip: "Na górze listy ZK jest skrót statusów — możesz go ukryć przyciskiem „Rozumiem”. Szczegóły też w Pomoc →.",
    },
    {
      id: "notatnik-notes",
      navKey: "notepad",
      navLabel: "Notatnik",
      href: "/notatnik",
      title: "Notatnik",
      lead:
        "Prywatne przypomnienia i notatki — tylko dla Ciebie. Nie trafiają do działu zakupów ani na Tablicę.",
      bullets: [
        "„Do zrobienia dziś” pokazuje notatki z przypomnieniem na dziś.",
        "Zakładka Notatki — dodajesz, przypinasz i ustawiasz datę follow-up.",
        "Archiwum — zarchiwizowane notatki możesz przywrócić lub usunąć.",
        "Licznik przy „Notatnik” w menu oznacza zaległe przypomnienia notatek (oddzielnie od ZK).",
      ],
      tip: "ZK z Subiekta są w osobnej zakładce „ZK czekające” — tam wysyłasz prośby do zakupów.",
    },
  ];

  if (isManager) {
    steps.push({
      id: "zespol",
      navKey: "team",
      navLabel: "Podgląd zespołu",
      href: "/zespol",
      title: "Podgląd zespołu",
      lead:
        "Jako kierownik widzisz prośby zespołu, ZK handlowców i możesz złożyć prośbę w ich imieniu.",
      bullets: [
        "Podgląd grup (Sklep / Biuro) bez logowania na konta innych osób.",
        "Widać m.in. ile ZK czeka na towar i kto ma zaległe przypomnienia.",
        "Skróty do kart handlowców i przypisań grup.",
        "W formularzu prośby wybierasz na początku handlowca, dla którego składasz zgłoszenie.",
      ],
      tip: "Poniżej zobaczysz przykładowy układ zespołu. Po zakończeniu touru lista będzie rzeczywista.",
    });
  }

  steps.push({
    id: "finish",
    title: "Gotowe — możesz zaczynać",
    lead:
      "To wszystko na start. Najczęściej zaczyna się od „Moje zamówienia” albo od pierwszej prośby do zakupów.",
    bullets: [
      "Menu po lewej (na telefonie — dolny pasek) prowadzi zawsze do tych samych zakładek.",
      "Statusy spraw sprawdzaj w aplikacji na bieżąco. E-mail to uzupełnienie przy ważnych zdarzeniach (dostępność, odbiór).",
      "Gdy coś będzie niejasne — zapytaj kierownika lub dział zakupów.",
    ],
  });

  return steps;
}

export function salesOnboardingStepCount(role: UserRole): number {
  return getSalesOnboardingSteps(role).length;
}
