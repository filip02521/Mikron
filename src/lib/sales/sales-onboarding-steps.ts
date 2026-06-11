import type { NavIconKey } from "@/components/icons/NavIcon";
import { isSalesManager } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

export type SalesOnboardingStep = {
  id: string;
  navKey?: NavIconKey;
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
  const steps: SalesOnboardingStep[] = [
    {
      id: "welcome",
      title: "Witaj w OnTime",
      lead: "OnTime łączy Cię z działem zakupów i magazynem. Zgłaszasz prośbę — reszta zespołu wie, co zrobić, i dostaniesz powiadomienie, gdy coś będzie gotowe.",
      bullets: [
        "Status spraw zobaczysz w aplikacji — bez dzwonienia i maili.",
        "Przejdziesz po głównych zakładkach. Przy każdej zobaczysz krótki opis i przykładowy ekran.",
        "Tour uruchamia się raz. Na końcu wracasz do swoich danych.",
      ],
    },
    {
      id: "moje",
      navKey: "myOrders",
      href: "/moje",
      title: "Moje zamówienia",
      lead: "Tu sprawdzasz status prośb — co czeka u dostawcy i co możesz odebrać z magazynu.",
      bullets: [
        "Jeden wiersz = jedna prośba u jednego dostawcy. Nagłówek mówi, co się dzieje.",
        "Przy wierszu widać klienta końcowego — łatwiej rozróżnisz sprawy różnych gabinetów.",
        "Fiolet = tylko pytanie o dostępność towaru (bez zamówienia u dostawcy). Dostaniesz e-mail, gdy towar będzie na magazynie.",
        "Zielony przycisk = Twoja akcja: potwierdź odbiór z magazynu albo zamknij powiadomienie.",
        "Na dole strony jest archiwum zakończonych spraw.",
      ],
      tip: "Przy wielu sprawach użyj filtrów u góry, np. „Do potwierdzenia”.",
    },
    {
      id: "prosba",
      navKey: "newRequest",
      href: "/prosba",
      title: "Nowa prośba",
      lead: "Tu zgłaszasz potrzebę do zakupów: zamówienie u dostawcy albo informację o dostępności towaru.",
      bullets: [
        "Krok 1: wybierz rodzaj — zamówienie u dostawcy albo informacja o towarze.",
        "Przy informacji masz dwie opcje: „Dostępność na magazynie” (e-mail + wpis w „Moje zamówienia”) albo „Brak na stanie — do zamówienia” (tylko sygnał dla zakupów, bez wpisu u Ciebie).",
        "Krok 2: wpisz produkt w jednym polu (nazwa lub symbol) i kod Mikran obok. Więcej pozycji dodajesz przyciskiem „+ Kolejny produkt”.",
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
      href: "/plan",
      title: "Harmonogram zakupów",
      lead: "Terminy u dostawców — pomaga zaplanować prośbę i powiedzieć klientowi, kiedy realnie można zamówić.",
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
      href: "/tablica",
      title: "Komunikacja z zakupami",
      lead: "Ogłoszenia od działu zakupów i wspólne pytania zespołu. To nie zastępuje formularza „Nowa prośba” przy zamówieniu towaru.",
      bullets: [
        "Dwie zakładki: Ogłoszenia (tylko do odczytu) i Pytania (widoczne dla całego działu handlowego).",
        "Ogłoszenia to komunikaty od zakupów, np. zmiana procedury. Nie odpowiadasz w tej sekcji.",
        "W Pytaniach zadajesz ogólne pytanie do zakupów. Odpowiedź widzą wszyscy handlowcy — bez powtarzania tych samych maili.",
        "Zamówienie towaru zgłaszasz w „Nowa prośba”, nie tutaj. Status śledzisz w „Moje zamówienia”.",
        "Liczba przy zakładce w menu przypomina o nowych ogłoszeniach lub odpowiedziach na pytania.",
      ],
      tip: "Zanim wyślesz pytanie, przejrzyj listę — może ktoś z zespołu już zadał to samo.",
    },
    {
      id: "notatnik",
      navKey: "clientZk",
      href: "/zk",
      title: "ZK czekające",
      lead: "Tu śledzisz zamówienia klientów (ZK) z Subiekta — na co czekasz, co dotarło na magazyn i skąd wysyłasz prośbę do zakupów. Notatki i archiwum są w osobnych zakładkach.",
      bullets: [
        "„Do zrobienia dziś” u góry — zacznij od przypomnień ZK i notatek.",
        "Zakładka „ZK” — wpisz numer ZK. System wczyta klienta i pozycje z Subiekta.",
        "Przy ZK jest „Zgłoś prośbę” — formularz wypełni się sam klientem i pozycjami.",
        "Po dostawie odhaczasz pozycje. Przy przypomnieniu ustawiasz datę follow-up.",
        "Zakładka „Notatki” — prywatne przypomnienia, bez wysyłki do zakupów.",
        "Liczba przy zakładce ZK czekające = zaległe przypomnienia (ZK lub notatki).",
      ],
      tip: "Status formalnych prośb jest w „Moje zamówienia”. ZK czekające pomaga pamiętać, które sprawy wymagają Twojej reakcji.",
    },
  ];

  if (isManager) {
    steps.push({
      id: "zespol",
      navKey: "team",
      href: "/zespol",
      title: "Podgląd zespołu",
      lead: "Jako kierownik widzisz prośby zespołu, ZK handlowców i możesz złożyć prośbę w ich imieniu.",
      bullets: [
        "Podgląd grup (Sklep / Biuro) bez logowania na konta innych osób.",
        "Widać m.in. ile ZK czeka na towar i kto ma zaległe przypomnienia.",
        "Skróty do kart handlowców i przypisań grup.",
        "W formularzu prośby wybierasz na początku handlowca, dla którego składasz zgłoszenie.",
      ],
    });
  }

  steps.push({
    id: "finish",
    title: "Gotowe — możesz zaczynać",
    lead: "To wszystko na start. Najczęściej zaczyna się od „Moje zamówienia” albo od pierwszej prośby do zakupów.",
    bullets: [
      "Menu po lewej (na telefonie — dolny pasek) prowadzi zawsze do tych samych zakładek.",
      "O ważnych zmianach dostaniesz też e-mail. Na co dzień sprawdzaj aplikację.",
      "Gdy coś będzie niejasne — zapytaj kierownika lub dział zakupów.",
    ],
  });

  return steps;
}

export function salesOnboardingStepCount(role: UserRole): number {
  return getSalesOnboardingSteps(role).length;
}
