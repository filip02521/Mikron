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
  dzis: "Zaległe terminy, harmonogram na dziś i prośby handlowców.",
  tydzien: "Plan zamówień w tygodniu — karty dostawców, przesunięcia i tryb planowania.",
  wyjatki:
    "Rezygnacje handlowców, prośby informacyjne, dostawcy na żądanie oraz pozycje poza harmonogramem.",
};

const PANEL_INTRO_SHORTCUTS = "Skróty: / — wyszukaj dostawcę · Nowa prośba · ⋯ — więcej akcji.";

/** Opis pod nagłówkiem panelu — treść dopasowana do aktywnej zakładki. */
export function dailyPanelIntroDescription(
  view: DailyPanelView,
  opts?: { includeShortcuts?: boolean }
): string {
  const includeShortcuts = opts?.includeShortcuts ?? true;
  const main = PANEL_INTRO_BY_VIEW[view];
  return includeShortcuts ? `${main} ${PANEL_INTRO_SHORTCUTS}` : main;
}
