import {
  INFORMACJA_FLOW_DIRECT,
  INFORMACJA_FLOW_STOCK_OUT,
  INFORMACJA_FLOW_VIA_PANEL,
} from "@/lib/orders/informacja-flow-copy";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";

/** Domyślna ścieżka po wyborze „Informacja”. */
export const DEFAULT_INFORMACJA_FLOW_PATH: InformacjaFlowPath = "direct";

export const INFORMACJA_FLOW_PICKER_SECTION = {
  title: "Co dalej z tą informacją?",
  hint: "Dostępność na magazynie albo sygnał dla zakupów o braku stanu — wybierz jedną opcję.",
} as const;

/** Panel dzienny → Nowa prośba — dodatkowa ścieżka „najpierw zamówienie u dostawcy”. */
export const INFORMACJA_FLOW_PICKER_SECTION_DAILY = {
  title: INFORMACJA_FLOW_PICKER_SECTION.title,
  hint: "Dostępność na magazynie, zamówienie u dostawcy albo brak na stanie — wybierz jedną opcję.",
} as const;

export type InformacjaFlowUiTone = "amber" | "indigo" | "violet";

export type InformacjaFlowUiDef = {
  path: InformacjaFlowPath;
  label: string;
  short: string;
  steps: string[];
  tone: InformacjaFlowUiTone;
  /** Krótka etykieta w panelu Dziś / na pozycji */
  lineBadge?: string;
};

/** Opcje widoczne w formularzu — tylko direct i stock_out (via_panel zostaje dla starych prośb). */
export const INFORMACJA_FLOW_UI: InformacjaFlowUiDef[] = [
  {
    path: "direct",
    label: INFORMACJA_FLOW_DIRECT.label,
    short: INFORMACJA_FLOW_DIRECT.short,
    steps: INFORMACJA_FLOW_DIRECT.steps,
    tone: "violet",
  },
  {
    path: "stock_out",
    label: INFORMACJA_FLOW_STOCK_OUT.label,
    short: INFORMACJA_FLOW_STOCK_OUT.short,
    steps: INFORMACJA_FLOW_STOCK_OUT.steps,
    tone: "amber",
    lineBadge: "Brak na stanie",
  },
];

export const INFORMACJA_VIA_PANEL_UI: InformacjaFlowUiDef = {
  path: "via_panel",
  label: INFORMACJA_FLOW_VIA_PANEL.label,
  short: "Najpierw zamówienie w Prośbach handlowców, potem magazyn i e-mail.",
  steps: INFORMACJA_FLOW_VIA_PANEL.steps,
  tone: "indigo",
  lineBadge: "Magazyn → info",
};

/** Opcje pickera — `includeViaPanel` tylko w panelu dziennym (Nowa prośba). */
export function informacjaFlowPickerOptions(options?: {
  includeViaPanel?: boolean;
}): InformacjaFlowUiDef[] {
  if (!options?.includeViaPanel) return INFORMACJA_FLOW_UI;
  return [INFORMACJA_FLOW_UI[0]!, INFORMACJA_VIA_PANEL_UI, INFORMACJA_FLOW_UI[1]!];
}

export function informacjaFlowUiForPath(path: InformacjaFlowPath): InformacjaFlowUiDef {
  return (
    INFORMACJA_FLOW_UI.find((f) => f.path === path) ??
    (path === "via_panel" ? INFORMACJA_VIA_PANEL_UI : INFORMACJA_FLOW_UI[0]!)
  );
}

export function informacjaProductsFormHint(path: InformacjaFlowPath): string {
  switch (path) {
    case "stock_out":
      return "Wystarczy nazwa lub symbol — bez ilości. Sygnał trafi do Prośb handlowców w panelu Dziś (bez wpisu u Ciebie).";
    case "via_panel":
      return "Wystarczy nazwa lub symbol — bez ilości. Zakupy zamówią u dostawcy, potem magazyn wyśle e-mail.";
    default:
      return "Wystarczy nazwa lub symbol — bez ilości. Magazyn obserwuje dostępność i wyśle e-mail po przyjęciu towaru.";
  }
}

export function informacjaReadinessSubline(
  path: InformacjaFlowPath,
  bannerKind: "complete" | "incomplete" | "empty"
): string {
  if (bannerKind === "complete") {
    switch (path) {
      case "stock_out":
        return "Kompletne — sygnał trafi do panelu Dziś (Prośby handlowców). Nie zobaczysz go w „Moje zamówienia”.";
      case "via_panel":
        return "Kompletne — najpierw Prośby handlowców, potem magazyn.";
      default:
        return "Kompletne — trafi do kolejki magazynu (informacja o dostępności).";
    }
  }
  switch (path) {
    case "stock_out":
      return "Po wysłaniu sygnał trafi wyłącznie do działu zakupów w panelu Dziś — bez wpisu w „Moje zamówienia”.";
    case "via_panel":
      return "Po wysłaniu najpierw Prośby handlowców (Główne/Uzupełniające), potem magazyn.";
    default:
      return "Po wysłaniu magazyn obserwuje dostępność — e-mail po dotarciu towaru na magazyn.";
  }
}

export function informacjaSalesFooterNote(path: InformacjaFlowPath): string {
  if (path === "stock_out") {
    return "Sygnał trafia wyłącznie do działu zakupów — bez wpisu w „Moje zamówienia”.";
  }
  if (path === "via_panel") {
    return "Najpierw zamówienie u dostawcy — e-mail po sprawdzeniu na magazynie.";
  }
  return "Powiadomimy e-mailem, gdy towar dotrze na magazyn.";
}

export const INFORMACJA_FLOW_CARD_STYLES: Record<
  InformacjaFlowUiTone,
  { active: string; idle: string; iconActive: string; iconIdle: string; summary: string }
> = {
  amber: {
    active: "border-amber-400 bg-amber-50/90 shadow-sm ring-2 ring-amber-400/25",
    idle: "border-slate-200 bg-white hover:border-amber-200/80 hover:bg-amber-50/30",
    iconActive: "bg-amber-200/90 text-amber-950",
    iconIdle: "bg-slate-100 text-slate-600",
    summary: "border-amber-200/90 bg-amber-50/50",
  },
  indigo: {
    active: "border-indigo-400 bg-indigo-50/90 shadow-sm ring-2 ring-indigo-400/25",
    idle: "border-slate-200 bg-white hover:border-indigo-200/80 hover:bg-indigo-50/30",
    iconActive: "bg-indigo-200/90 text-indigo-950",
    iconIdle: "bg-slate-100 text-slate-600",
    summary: "border-indigo-200/90 bg-indigo-50/50",
  },
  violet: {
    active: "border-violet-400 bg-violet-50/90 shadow-sm ring-2 ring-violet-400/25",
    idle: "border-slate-200 bg-white hover:border-violet-200/80 hover:bg-violet-50/30",
    iconActive: "bg-violet-200/90 text-violet-950",
    iconIdle: "bg-slate-100 text-slate-600",
    summary: "border-violet-200/90 bg-violet-50/50",
  },
};

export const INFORMACJA_FLOW_LINE_BADGE_STYLES: Record<
  InformacjaFlowUiTone,
  string
> = {
  amber: "bg-amber-100 text-amber-900",
  indigo: "bg-indigo-100 text-indigo-900",
  violet: "bg-violet-100 text-violet-900",
};
