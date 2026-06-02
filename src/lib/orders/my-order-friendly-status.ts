/** Przystępne etykiety statusów w /moje — bez żargonu panelu dziennego. */
const FRIENDLY_STATUS: Record<string, string> = {
  "W dziale dostaw": "Sprawdzamy Twoją prośbę",
  "Dopasowujemy dostawcę": "Szukamy właściwego dostawcy",
  "Uzupełnianie danych": "Uzupełniamy brakujące dane",
  "Przed zamówieniem": "Czeka, aż zamówimy u dostawcy",
  Zamówione: "Zamówione — czekamy na dostawę",
  "Częściowo na magazynie": "Część towaru jest już u nas",
  "Do odbioru": "Gotowe do odbioru z magazynu",
  "Oczekuje na magazyn": "Magazyn sprawdza dostępność",
  "Czekamy na zamówienie u dostawcy": "Zamówimy u dostawcy, gdy będzie potrzeba",
  "Zamówione — czekamy na magazyn": "Zamówione u dostawcy — czekamy na magazyn",
  Dostępne: "Towar dostępny u dostawcy",
  Anulowano: "Prośba anulowana",
  Anulowane: "Prośba anulowana",
};

export function myOrderFriendlyStatusLabel(statusTitle: string): string {
  return FRIENDLY_STATUS[statusTitle] ?? statusTitle;
}

export function myOrderFriendlyStatusHint(statusTitle: string): string | null {
  switch (statusTitle) {
    case "W dziale dostaw":
    case "Dopasowujemy dostawcę":
    case "Uzupełnianie danych":
      return "Nie musisz nic robić — damy znać, gdy będzie postęp.";
    case "Przed zamówieniem":
      return "Dział dostaw złoży zamówienie u dostawcy.";
    case "Zamówione":
      return "Towar jest w drodze od dostawcy.";
    case "Oczekuje na magazyn":
      return "Sprawdzamy, czy mamy towar na stanie.";
    default:
      return null;
  }
}
