/** Wspólne opisy ścieżek prośby informacyjnej (panel zakupów, magazyn, handlowiec). */

export const INFORMACJA_FLOW_DIRECT = {
  id: "direct" as const,
  label: "Powiadom, gdy będzie na magazynie",
  short:
    "To nie zapytanie u dostawcy. Obserwujemy stan magazynowy i wysyłamy e-mail, gdy towar się pojawi.",
  /** Krótka etykieta na badge’ach (weryfikacja, panel). */
  badgeLabel: "Stan magazynowy",
  steps: ["Zgłoszenie", "Obserwacja stanu magazynowego", "E-mail do Ciebie"],
};

export const INFORMACJA_FLOW_VIA_PANEL = {
  id: "via_panel" as const,
  label: "Najpierw zamówienie u dostawcy",
  short:
    "Najpierw zamówienie u dostawcy w panelu Dziś, potem sprawdzenie na magazynie i e-mail do handlowca.",
  steps: [
    "Zgłoszenie handlowca",
    "Zamówienie u dostawcy (Główne lub Uzupełniające)",
    "Sprawdzenie na magazynie",
    "Wiadomość e-mail do handlowca",
  ],
};

/** Tylko sygnał dla działu zakupów — bez kolejki magazynu i bez powiadomienia handlowca. */
export const INFORMACJA_FLOW_STOCK_OUT = {
  id: "stock_out" as const,
  label: "Brak na stanie — do zamówienia",
  short: "Zgłoś do działu zakupów, że brakuje towaru na stanie.",
  steps: ["Zgłoszenie", "Panel Dziś — zamówienie u dostawcy"],
};

export const INFORMACJA_STOCK_OUT_PANEL_BADGE = "Brak na stanie";

export const INFORMACJA_STOCK_OUT_PROCUREMENT_SECTION_HINT =
  "To nie są prośby klientów — sygnały, że towar się skończył na magazynie. Po Główne pozycja znika z listy.";

export const INFORMACJA_FLOW_SALES_STOCK_OUT = {
  statusTitle: "Brak na stanie — zakupy zamówią",
  statusDetail:
    "To tylko sygnał dla działu zakupów. Nie czekasz na e-mail z magazynu — postęp zobaczysz po zamówieniu u dostawcy.",
};

export const INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED = {
  statusTitle: "Zamówione u dostawcy",
  statusDetail:
    "Zakupy złożyły zamówienie. Nie dostaniesz e-maila z magazynu — to był tylko sygnał o braku stanu.",
};

/** Etykieta na pozycji w panelu Dziś (ścieżka: magazyn sprawdza, potem informacja dla handlowca). */
export const INFORMACJA_VIA_PANEL_BADGE = "Magazyn → info";

export const INFORMACJA_VIA_PANEL_STATUS_TITLE = INFORMACJA_VIA_PANEL_BADGE;

export const INFORMACJA_FLOW_LEGEND_PANEL =
  "„Powiadom, gdy będzie na magazynie” — obserwujemy nasz stan magazynowy i wysyłamy e-mail, gdy towar się pojawi (bez zapytania u dostawcy). „Brak na stanie” — tylko Prośby handlowców (zakupy zamawiają u dostawcy, bez e-maila z magazynu).";

/** Krótki opis pod pozycją w panelu Dziś (szczegóły ścieżki: badge + legenda). */
export const INFORMACJA_FLOW_PROCUREMENT_GROUP_BANNER =
  "Prośba informacyjna — najpierw zamów u dostawcy, potem magazyn wyśle e-mail do handlowca.";

export const INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT = {
  statusTitle: "Czekamy na zamówienie u dostawcy",
  statusDetail:
    "Dział zakupów złoży zamówienie u dostawcy. Gdy towar pojawi się na stanie magazynowym, dostaniesz e-mail.",
};

export const INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE = {
  statusTitle: "Zamówione — czekamy na magazyn",
  statusDetail:
    "Zamówienie u dostawcy jest złożone. Powiadomimy e-mailem, gdy towar pojawi się na stanie magazynowym.",
};

export const INFORMACJA_FLOW_SALES_DIRECT = {
  statusTitle: "Informacja o dostępności",
  statusDetail:
    "Obserwujemy, czy towar pojawi się na stanie magazynowym. Powiadomimy e-mailem, gdy będzie dostępny.",
};

/** Status „Dostępne” — ręczne powiadomienie z magazynu. */
export const INFORMACJA_FLOW_SALES_READY_MANUAL_DETAIL =
  "Towar jest na magazynie. Potwierdź, że widziałeś/aś powiadomienie — wpis zniknie z listy.";

/** Status „Dostępne” — automatyka ze stanu Subiekta. */
export const INFORMACJA_FLOW_SALES_AUTO_ARRIVED_DETAIL =
  "Powiadomienie wysłano automatycznie po wykryciu towaru na stanie w Subiekcie. Potwierdź odczyt — wpis zniknie z listy.";

/** Nagłówek wiersza, gdy magazyn wysłał e-mail i handlowiec ma potwierdzić odczytanie. */
export const INFORMACJA_FLOW_SALES_READY_ACK_HEADLINE = "Powiadomienie o dostępności";

/** Poprzedni tytuł statusu — zostaje w starych wpisach / testach. */
export const INFORMACJA_AVAILABILITY_STATUS_TITLE_LEGACY = "Oczekuje na magazyn";

/** Magazyn — banner nad kolejką informacji. */
export const INFORMACJA_AUTO_STOCK_QUEUE_HINT =
  "Towary z kartoteki Subiekta mogą zostać powiadomione automatycznie, gdy pojawi się stan magazynowy.";

export const INFORMACJA_AUTO_STOCK_ROW_BADGE = "Na stanie w Subiekcie";

export const INFORMACJA_AUTO_STOCK_ROW_DETAIL =
  "Stan dodatni w Subiekcie — powiadomienie wyśle synchronizacja (do ok. godziny) lub po odświeżeniu kolejki.";

export const INFORMACJA_MANUAL_ONLY_ROW_HINT =
  "Pozycja spoza kartoteki Subiekta — powiadom handlowca ręcznie po sprawdzeniu towaru.";

export const INFORMACJA_MANUAL_ONLY_TOOLTIP =
  "Brak powiązania z Subiektem (wpis ręczny). Automatyka stanu nie obejmuje tej pozycji.";

export const INFORMACJA_TEETH_MANUAL_ONLY_HINT =
  "Prośba zębowa — powiadomienie tylko ręcznie (poza automatyką stanu).";

/** Toast magazynu po auto-sync na /kolejka. */
export function formatInformacjaAutoArrivedToast(updated: number): {
  title: string;
  text: string;
} {
  if (updated <= 0) {
    return { title: "Synchronizacja informacji", text: "Brak nowych powiadomień." };
  }
  if (updated === 1) {
    return {
      title: "Powiadomiono automatycznie",
      text: "1 pozycja — wykryto stan w Subiekcie.",
    };
  }
  return {
    title: "Powiadomiono automatycznie",
    text: `${updated} pozycji — wykryto stan w Subiekcie.`,
  };
}

export type InformacjaArrivedSource = "manual" | "stock_auto";

/** Agregacja źródeł domknięcia w grupie wierszy / inboxie. */
export type InformacjaArrivedSourceMix = InformacjaArrivedSource | "mixed" | null;

export function resolveInformacjaArrivedSourceMix(
  sources: Array<InformacjaArrivedSource | null | undefined>
): InformacjaArrivedSourceMix {
  const resolved = sources.filter(
    (s): s is InformacjaArrivedSource => s === "manual" || s === "stock_auto"
  );
  if (!resolved.length) return null;
  const hasAuto = resolved.some((s) => s === "stock_auto");
  const hasManual = resolved.some((s) => s === "manual");
  if (hasAuto && hasManual) return "mixed";
  return hasAuto ? "stock_auto" : "manual";
}

/** Subline karty / inboxu przy oczekiwaniu na potwierdzenie informacji (Moje zamówienia). */
export function informacjaReadyAckSubline(input: {
  sourceMix: InformacjaArrivedSourceMix;
  informacjaPath?: "direct" | "via_panel" | "stock_out";
}): string {
  const { sourceMix, informacjaPath } = input;
  if (sourceMix === "stock_auto") {
    return "Powiadomienie wysłano automatycznie (stan w Subiekcie) — potwierdź odczyt";
  }
  if (sourceMix === "mixed") {
    return "Powiadomienia o dostępności — potwierdź odczyt";
  }
  if (informacjaPath === "via_panel") {
    return "Magazyn potwierdził dostępność — potwierdź odczyt";
  }
  return "Potwierdź, że widziałeś/aś powiadomienie o dostępności";
}

/** Subtitle wpisu Start dnia / inboxu dla informacji do potwierdzenia. */
export function informacjaReadyDayStartSubtitle(
  rows: Array<{
    informacjaArrivedSourceMix?: InformacjaArrivedSourceMix;
    informacjaPath?: "direct" | "via_panel" | "stock_out";
  }>
): string {
  if (!rows.length) {
    return "Powiadomienie o dostępności — potwierdź odczyt";
  }
  const sourceMix = resolveInformacjaArrivedSourceMix(
    rows.flatMap((row) => {
      const mix = row.informacjaArrivedSourceMix;
      if (mix === "mixed") return ["manual", "stock_auto"] as const;
      if (mix === "stock_auto" || mix === "manual") return [mix];
      return [];
    })
  );
  if (sourceMix === "stock_auto") {
    return "Stan w Subiekcie — potwierdź odczyt powiadomienia";
  }
  if (sourceMix === "mixed") {
    return "Powiadomienia o dostępności — potwierdź odczyt";
  }
  const paths = rows.map((r) => r.informacjaPath).filter(Boolean);
  const allViaPanel = paths.length > 0 && paths.every((p) => p === "via_panel");
  if (allViaPanel) {
    return "Magazyn potwierdził dostępność — potwierdź odczyt";
  }
  return "Powiadomienie o dostępności — potwierdź odczyt";
}

/** Tytuł wpisu Start dnia dla informacji do potwierdzenia. */
export function informacjaReadyDayStartTitle(count: number): string {
  if (count === 1) {
    return "Potwierdź powiadomienie o dostępności";
  }
  return `Potwierdź powiadomienia o dostępności (${count})`;
}

export function isInformacjaAvailabilityPendingStatusTitle(title: string): boolean {
  return (
    title === INFORMACJA_FLOW_SALES_DIRECT.statusTitle ||
    title === INFORMACJA_AVAILABILITY_STATUS_TITLE_LEGACY
  );
}
