export const DAILY_PANEL_VIEWS = ["dzis", "tydzien", "wyjatki"] as const;

export type DailyPanelView = (typeof DAILY_PANEL_VIEWS)[number];

/** @deprecated użyj `wyjatki` */
export const LEGACY_DAILY_PANEL_VIEW_NARZEDZIA = "narzedzia";

export function parseDailyPanelView(raw: string | null | undefined): DailyPanelView {
  if (raw === "tydzien") return "tydzien";
  if (raw === "wyjatki" || raw === LEGACY_DAILY_PANEL_VIEW_NARZEDZIA) return "wyjatki";
  return "dzis";
}

export function dailyPanelViewLabel(view: DailyPanelView): string {
  switch (view) {
    case "dzis":
      return "Dziś";
    case "tydzien":
      return "Tydzień";
    case "wyjatki":
      return "Wyjątki";
  }
}
