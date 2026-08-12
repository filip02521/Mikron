/** Copy kontekstu ZK na formularzu prośby (sticky baner + nagłówek). */

function polishNowePozycje(count: number): string {
  const n = Math.max(0, Math.trunc(count));
  if (n === 1) return "1 nowa pozycja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} nowe pozycje`;
  }
  return `${n} nowych pozycji`;
}

export const ZK_PROSBA_LINK_BANNER_COPY = {
  badge: "Powiązana z ZK",
  badgeSupplement: "Uzupełnienie ZK",
  /** Krótki tytuł wiersza (bez numeru ZK — ten jest w meta). */
  titleFull: "Tworzysz prośbę z zamówienia klienta",
  titleSupplement: "Uzupełniająca prośba",
  /** @deprecated Używane w testach / starszych odwołaniach — preferuj titleFull. */
  leadCreating: "Tworzysz prośbę powiązaną z",
  /** Nagłówek karty formularza gdy jest kontekst ZK. */
  formTitle: "Nowa prośba z ZK",
  fullLockedDetail:
    "Pozycje pochodzą z tego zamówienia klienta. Możesz wybrać tylko produkty z ZK — po wysłaniu prośba pojawi się przy nim w notatniku.",
  fullUnlockedDetail:
    "Brak kodów produktów Subiekta na tym ZK — katalog nie jest ograniczony. Uzupełnij pozycje ręcznie.",
  supplementLockedSuffix: "Możesz dodać tylko produkty z tego ZK.",
  supplementAlreadyOrdered:
    "Wcześniejsze pozycje są już w zamówieniu.",
  caseNoteTitle: "Notatka ze sprawy ZK jest w uwagach pozycji",
  caseNoteHint: "Zakupy ją zobaczą przy realizacji.",
  typeaheadHint: "W tej prośbie widać tylko produkty z powiązanego ZK.",
  productsSectionHint: "Tylko produkty z powiązanego ZK — wyszukaj i wybierz z listy.",
  readinessHeadline: "Wybierz produkt z ZK",
  readinessSubline: "Każda pozycja musi pochodzić z powiązanego zamówienia klienta.",
  readinessProductDetail: "Wybierz towar z listy ZK",
} as const;

/** Treść opisu dla trybu uzupełnienia — jedna spójna linia. */
export function formatZkProsbaSupplementDetail(
  lineCount: number,
  catalogLocked: boolean
): string {
  const parts = [
    `${polishNowePozycje(lineCount)} z ZK.`,
    ZK_PROSBA_LINK_BANNER_COPY.supplementAlreadyOrdered,
  ];
  if (catalogLocked) {
    parts.push(ZK_PROSBA_LINK_BANNER_COPY.supplementLockedSuffix);
  }
  return parts.join(" ");
}

export const TEETH_ALLOWED_TW_IDS_HINT =
  "W tym panelu widać tylko produkty z katalogu zębów (Admin → Produkty zębowe).";
