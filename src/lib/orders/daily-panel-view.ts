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

const PANEL_INTRO_BY_VIEW: Record<DailyPanelView, string> = {
  dzis: "Kolejka na dziś — zaległe, prośby handlowców, rezygnacje.",
  tydzien: "Plan zamówień w tygodniu.",
  wyjatki: "Informacja, dostawcy na żądanie i pozycje poza harmonogramem.",
};

const PANEL_INTRO_SHORTCUTS =
  "Skróty: / — wyszukaj dostawcę · ↑↓ — grupy prośby · Shift+G / Shift+U — główne / uzupełniające · Ctrl+Z — cofnij.";

/** Opis pod nagłówkiem panelu — treść dopasowana do aktywnej zakładki. */
export function dailyPanelIntroDescription(
  view: DailyPanelView,
  opts?: { includeShortcuts?: boolean }
): string {
  const includeShortcuts = opts?.includeShortcuts ?? false;
  const main = PANEL_INTRO_BY_VIEW[view];
  return includeShortcuts ? `${main} ${PANEL_INTRO_SHORTCUTS}` : main;
}
