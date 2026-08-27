export type ZkWatchRowColorLegendItemId =
  | "regal"
  | "ready_to_close"
  | "informacja"
  | "follow_up"
  | "new_lines";

export type ZkWatchRowColorLegendItem = {
  id: ZkWatchRowColorLegendItemId;
  label: string;
  title: string;
  /** Dłuższy opis w przewodniku. */
  detail: string;
  /** Zawsze widoczne w skróconej legendzie nad listą. */
  core?: boolean;
};

export const ZK_WATCH_ROW_COLOR_LEGEND_ITEMS: ZkWatchRowColorLegendItem[] = [
  {
    id: "regal",
    label: "Regal",
    title: "Fiolet — odbiór w Moje",
    detail: "Towar czeka na odbiór z regału — potwierdź w Moje zamówienia",
    core: true,
  },
  {
    id: "ready_to_close",
    label: "Do zamknięcia",
    title: "Zielony rail",
    detail: "Wszystkie pozycje odhaczone — możesz zamknąć sprawę ZK",
    core: true,
  },
  {
    id: "informacja",
    label: "Dostępne",
    title: "Niebieski",
    detail: "Magazyn potwierdził dostępność — prośba informacyjna",
  },
  {
    id: "follow_up",
    label: "Przypomnienie",
    title: "Bursztyn",
    detail: "Termin przypomnienia minął — sprawdź kalendarz w wierszu",
  },
  {
    id: "new_lines",
    label: "Nowe pozycje",
    title: "Bursztynowy akcent",
    detail: "Nowe pozycje w ZK od ostatniego odświeżenia",
  },
];

export function pickZkWatchRowColorLegendItems(input: {
  regalLineCount?: number;
  informacjaReadyLineCount?: number;
  followUpCount?: number;
  newLinesWatchCount?: number;
  compact?: boolean;
}): ZkWatchRowColorLegendItem[] {
  const {
    regalLineCount = 0,
    informacjaReadyLineCount = 0,
    followUpCount = 0,
    newLinesWatchCount = 0,
    compact = true,
  } = input;

  if (!compact) {
    return ZK_WATCH_ROW_COLOR_LEGEND_ITEMS;
  }

  return ZK_WATCH_ROW_COLOR_LEGEND_ITEMS.filter((item) => {
    if (item.core) return true;
    if (item.id === "informacja") return informacjaReadyLineCount > 0;
    if (item.id === "follow_up") return followUpCount > 0;
    if (item.id === "new_lines") return newLinesWatchCount > 0;
    if (item.id === "regal") return regalLineCount > 0;
    return false;
  });
}
