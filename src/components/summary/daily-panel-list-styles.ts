import { cn } from "@/lib/cn";
import { surfaceCardClass } from "@/lib/ui/ontime-theme";

/** Wspólny padding listy w sekcjach panelu Dziś / Wyjątki. */
export const dailyPanelListInsetClass = "p-2 sm:p-2.5";

/** Kontener listy kart (space-y między wierszami). */
export const dailyPanelListBodyClass = cn(dailyPanelListInsetClass, "space-y-1.5");

/** Padding pojedynczego wiersza w płaskiej liście (divide-y). */
export const dailyPanelListRowPaddingClass = "px-3 py-2.5 sm:px-3.5 sm:py-3";

export type DailyPanelListDivideTone = "neutral" | "amber" | "indigo" | "sky";

/** Separator wierszy w płaskiej liście — dopasowany do tonu sekcji. */
export function dailyPanelFlatListClass(tone: DailyPanelListDivideTone = "neutral"): string {
  switch (tone) {
    case "amber":
      return "divide-y divide-amber-100/80";
    case "indigo":
      return "divide-y divide-indigo-100/70";
    case "sky":
      return "divide-y divide-sky-100/80";
    default:
      return "divide-y divide-slate-100/90";
  }
}

export type DailyPanelCardAccent = "neutral" | "amber" | "sky" | "indigo";

/** Karta wiersza — delikatny ton bez lewego paska. */
export function dailyPanelCardRowClass(accent: DailyPanelCardAccent = "neutral"): string {
  switch (accent) {
    case "amber":
      return "rounded-md border border-amber-200/85 bg-amber-50/20 shadow-sm";
    case "sky":
      return "rounded-md border border-sky-200/80 bg-sky-50/15 shadow-sm";
    case "indigo":
      return "rounded-md border border-indigo-200/75 bg-indigo-50/10 shadow-sm";
    default:
      return cn(surfaceCardClass, "shadow-[var(--shadow-card)]");
  }
}

/** Delikatny hover na klikalnych kartach listy. */
export function dailyPanelCardRowInteractiveClass(accent: DailyPanelCardAccent = "neutral"): string {
  return cn(
    dailyPanelCardRowClass(accent),
    "transition-shadow hover:shadow-md",
    accent === "amber" && "hover:border-amber-200/90",
    accent === "sky" && "hover:border-sky-200/90",
    accent === "indigo" && "hover:border-indigo-200/85",
    accent === "neutral" && "hover:border-slate-300/85 hover:shadow-[var(--shadow-card-elevated)]"
  );
}
