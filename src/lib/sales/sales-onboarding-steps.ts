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
      lead: "OnTime łączy handlowca z działem zakupów i magazynem. Zgłaszasz prośbę — reszta zespołu wie, co zrobić i kiedy Cię powiadomić.",
      bullets: [
        "Nie musisz dzwonić ani pisać maili o status — wszystko widać w aplikacji.",
        "Za chwilę przejdziemy przez główne zakładki w menu.",
        "Ten tour uruchamia się tylko raz — po zakończeniu zobaczysz swoje rzeczywiste dane.",
      ],
    },
    {
      id: "moje",
      navKey: "myOrders",
      href: "/moje",
      title: "Moje zamówienia",
      lead: "Twoja skrzynka statusów — tu wracasz codziennie, żeby zobaczyć, co jest do odbioru i co czeka u dostawcy.",
      bullets: [
        "Każdy wiersz to jedna prośba u jednego dostawcy — nagłówek mówi, co się dzieje.",
        "Fioletowe tło oznacza prośbę tylko o dostępność — bez zamówienia u dostawcy; dostaniesz e-mail, gdy towar będzie na magazynie.",
        "Zielony przycisk pojawia się tylko wtedy, gdy musisz coś potwierdzić (odbiór z magazynu lub zamknięcie powiadomienia).",
        "Na dole strony jest archiwum zakończonych prośb.",
      ],
      tip: "Filtry u góry (np. „Do potwierdzenia”) pomagają, gdy masz wiele aktywnych spraw naraz.",
    },
    {
      id: "prosba",
      navKey: "newRequest",
      href: "/prosba",
      title: "Nowa prośba",
      lead: "Tu zgłaszasz potrzebę do działu zakupów — zamówienie u dostawcy albo tylko informację, gdy towar ma trafić na magazyn.",
      bullets: [
        "Na początku wybierasz rodzaj: zamówienie u dostawcy albo informacja o towarze.",
        "Przy informacji wybierasz ścieżkę: „Informacja o dostępności” (magazyn + e-mail, widoczne w „Moje zamówienia”) albo „Brak na stanie — do zamówienia” (tylko sygnał dla zakupów — bez wpisu u Ciebie).",
        "Produkt wpisujesz w jednym polu — nazwa lub symbol; kod Mikran obok. Kolejne pozycje dodajesz przyciskiem „+ Kolejny produkt”.",
        "Dostawcy nie wybierasz z listy: system sam przypisze właściwą firmę po symbolu lub kodzie (zakupy doprecyzują, gdy czegoś brakuje).",
        "Po wysłaniu zamówienia i prośby o dostępność widać w „Moje zamówienia” — każdy dostawca ma osobny wiersz ze statusem.",
        "Z notatnika możesz też wysłać prośbę prosto z karty ZK — klient i produkty uzupełnią się same.",
      ],
      tip: "Przy każdej pozycji podaj klienta i czytelny opis — wtedy zakupy często ogarniają sprawę bez dodatkowych pytań.",
    },
    {
      id: "plan",
      navKey: "plan",
      href: "/plan",
      title: "Harmonogram zakupów",
      lead: "Kalendarz terminów u dostawców — planujesz prośby z wyprzedzeniem i widzisz, kiedy zbliża się kolejne okno zamówienia.",
      bullets: [
        "Lista „Z otwartymi prośbami” pokazuje dostawców z aktywnych wpisów w „Moje zamówienia” — rozwiń wiersz po termin i czas realizacji.",
        "Wyszukiwarka u góry służy do każdego innego dostawcy w bazie.",
        "Plan działu dostaw (kalendarz pon.–pt.) możesz rozwinąć u góry karty — to harmonogram składania zamówień przez zakupy, nie termin towaru na magazynie.",
        "Przydatne przed rozmową z klientem — wiesz, kiedy realnie można zamówić.",
      ],
    },
    {
      id: "notatnik",
      navKey: "notepad",
      href: "/notatnik",
      title: "Notatnik",
      lead: "Twoja prywatna tablica robocza: notatki dla siebie oraz lista zamówień klienta (ZK), na które jeszcze czekacie. To coś innego niż prośby do zakupów — tu pilnujesz spraw po swojemu, zanim lub obok zgłoszenia do działu zakupów.",
      bullets: [
        "U góry „Do zrobienia dziś” zbiera przypomnienia z notatek i ZK — to pierwsza rzecz, na którą warto rzucić okiem.",
        "Niżej dodajesz własne notatki z datą przypomnienia — np. „oddzwonić w piątek”.",
        "W sekcji „Czeka na towar” wpisujesz numer ZK z Subiekta — system wczytuje klienta i pozycje (potrzebne jest połączenie z systemem magazynowym).",
        "Przy każdym ZK jest „Zgłoś prośbę” — formularz wypełni się klientem i produktami z tego zamówienia.",
        "Do każdego ZK dopisujesz własną notatkę, ustawiasz przypomnienie i po dostawie oznaczasz sprawę jako zamkniętą.",
        "Czerwona liczba na zakładce Notatnik przypomina o zaległych przypomnieniach — przy ZK i notatkach.",
      ],
      tip: "Status prośb do zakupów śledzisz w „Moje zamówienia”. Notatnik pomaga pamiętać, które ZK wymagają Twojej reakcji.",
    },
  ];

  if (isManager) {
    steps.push({
      id: "zespol",
      navKey: "team",
      href: "/zespol",
      title: "Podgląd zespołu",
      lead: "Jako kierownik widzisz status prośb całego zespołu, podglądasz notatniki handlowców i możesz złożyć prośbę w ich imieniu.",
      bullets: [
        "Podgląd aktywności grup (Sklep / Biuro) bez logowania się na ich konta.",
        "Widać m.in. ile ZK czeka u handlowca na towar i kto ma przypomnienia do zrobienia.",
        "Skrót do kart handlowców i przypisań grup w sekcji Zespół.",
        "W formularzu prośby możesz na początku wybrać osobę, dla której składasz zgłoszenie.",
      ],
    });
  }

  steps.push({
    id: "finish",
    title: "Gotowe — możesz zaczynać",
    lead: "Masz obraz całości. Możesz zacząć od „Moje zamówienia”, dodać ZK w notatniku albo od razu złożyć prośbę.",
    bullets: [
      "Menu po lewej (na telefonie — dolny pasek) zawsze prowadzi do tych samych zakładek.",
      "O ważnych zmianach dostaniesz też e-mail — aplikacja jest źródłem na co dzień.",
    ],
  });

  return steps;
}

export function salesOnboardingStepCount(role: UserRole): number {
  return getSalesOnboardingSteps(role).length;
}
