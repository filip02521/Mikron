import { cn } from "@/lib/cn";
import type { ProcurementFlagColor } from "@/lib/orders/procurement-request-flag";

/**
 * Wizualny ton toru — jasne tła jak chipy flag / panel dzienny.
 * `indigo` = tor systemowy „Do rozdzielenia”; reszta = kolory flag.
 */
export type ProcurementRequestLaneTone = ProcurementFlagColor | "indigo";

const LANE_DOT: Record<ProcurementRequestLaneTone, string> = {
  indigo: "bg-indigo-500",
  rose: "bg-rose-500",
  amber: "bg-amber-500",
  emerald: "bg-emerald-500",
  sky: "bg-sky-500",
  violet: "bg-violet-500",
  fuchsia: "bg-fuchsia-500",
  slate: "bg-slate-400",
};

/** Obudowa toru — bardzo jasne tło (jak pozostałe flagi). */
const LANE_SHELL: Record<ProcurementRequestLaneTone, string> = {
  indigo: "border-indigo-200/70 bg-indigo-50/20",
  rose: "border-rose-200/70 bg-rose-50/20",
  amber: "border-amber-200/75 bg-amber-50/25",
  emerald: "border-emerald-200/70 bg-emerald-50/20",
  sky: "border-sky-200/70 bg-sky-50/20",
  violet: "border-violet-200/70 bg-violet-50/20",
  fuchsia: "border-fuchsia-200/70 bg-fuchsia-50/20",
  slate: "border-slate-200/80 bg-white/70",
};

const LANE_HEADER: Record<ProcurementRequestLaneTone, string> = {
  indigo: "border-indigo-100/80 bg-indigo-50/55",
  rose: "border-rose-100/80 bg-rose-50/50",
  amber: "border-amber-100/85 bg-amber-50/55",
  emerald: "border-emerald-100/80 bg-emerald-50/50",
  sky: "border-sky-100/80 bg-sky-50/50",
  violet: "border-violet-100/80 bg-violet-50/50",
  fuchsia: "border-fuchsia-100/80 bg-fuchsia-50/50",
  slate: "border-slate-100/90 bg-slate-50/70",
};

const LANE_HEADER_HOVER: Record<ProcurementRequestLaneTone, string> = {
  indigo: "hover:bg-indigo-50/80",
  rose: "hover:bg-rose-50/75",
  amber: "hover:bg-amber-50/80",
  emerald: "hover:bg-emerald-50/75",
  sky: "hover:bg-sky-50/75",
  violet: "hover:bg-violet-50/75",
  fuchsia: "hover:bg-fuchsia-50/75",
  slate: "hover:bg-slate-50",
};

const LANE_COUNT_PILL: Record<ProcurementRequestLaneTone, string> = {
  indigo: "bg-white/90 text-indigo-800 ring-indigo-200/70",
  rose: "bg-white/90 text-rose-800 ring-rose-200/70",
  amber: "bg-white/90 text-amber-900 ring-amber-200/70",
  emerald: "bg-white/90 text-emerald-800 ring-emerald-200/70",
  sky: "bg-white/90 text-sky-900 ring-sky-200/70",
  violet: "bg-white/90 text-violet-800 ring-violet-200/70",
  fuchsia: "bg-white/90 text-fuchsia-800 ring-fuchsia-200/70",
  slate: "bg-white/90 text-slate-700 ring-slate-200/80",
};

const LANE_NAV_CHIP: Record<ProcurementRequestLaneTone, string> = {
  indigo:
    "border-indigo-200/85 bg-indigo-50/50 text-indigo-900 hover:border-indigo-300 hover:bg-indigo-50",
  rose: "border-rose-200/85 bg-rose-50/45 text-rose-900 hover:border-rose-300 hover:bg-rose-50",
  amber:
    "border-amber-200/85 bg-amber-50/50 text-amber-950 hover:border-amber-300 hover:bg-amber-50",
  emerald:
    "border-emerald-200/85 bg-emerald-50/45 text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50",
  sky: "border-sky-200/85 bg-sky-50/45 text-sky-950 hover:border-sky-300 hover:bg-sky-50",
  violet:
    "border-violet-200/85 bg-violet-50/45 text-violet-900 hover:border-violet-300 hover:bg-violet-50",
  fuchsia:
    "border-fuchsia-200/85 bg-fuchsia-50/45 text-fuchsia-900 hover:border-fuchsia-300 hover:bg-fuchsia-50",
  slate:
    "border-slate-200/90 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800",
};

const LANE_NAV_COUNT: Record<ProcurementRequestLaneTone, string> = {
  indigo: "bg-indigo-100/80 text-indigo-800",
  rose: "bg-rose-100/80 text-rose-800",
  amber: "bg-amber-100/80 text-amber-900",
  emerald: "bg-emerald-100/80 text-emerald-800",
  sky: "bg-sky-100/80 text-sky-900",
  violet: "bg-violet-100/80 text-violet-800",
  fuchsia: "bg-fuchsia-100/80 text-fuchsia-800",
  slate: "bg-slate-200/80 text-slate-700",
};

export function resolveProcurementRequestLaneTone(
  color: ProcurementFlagColor | "indigo" | null | undefined
): ProcurementRequestLaneTone {
  if (!color) return "slate";
  if (color === "indigo") return "indigo";
  return color;
}

/** Obudowa jednego toru w liście (bez overflow — sticky nagłówek). */
export function procurementRequestLaneShellClass(
  tone: ProcurementRequestLaneTone
): string {
  return cn("rounded-md border shadow-sm", LANE_SHELL[tone]);
}

/** Sticky nagłówek toru. */
export function procurementRequestLaneHeaderClass(
  tone: ProcurementRequestLaneTone,
  collapsed = false
): string {
  return cn(
    "sticky top-0 z-[1] flex w-full items-center gap-2 border-b px-2.5 py-2 text-left backdrop-blur-sm sm:px-3",
    "bg-white/75 transition-[border-radius,background-color,border-color] duration-200 ease-out",
    LANE_HEADER[tone],
    LANE_HEADER_HOVER[tone],
    collapsed ? "rounded-md border-b-transparent" : "rounded-t-md"
  );
}

export function procurementRequestLaneDotClass(tone: ProcurementRequestLaneTone): string {
  return cn("h-1.5 w-1.5 shrink-0 rounded-full", LANE_DOT[tone]);
}

export function procurementRequestLaneCountPillClass(
  tone: ProcurementRequestLaneTone
): string {
  return cn(
    "inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold tabular-nums ring-1 ring-inset",
    LANE_COUNT_PILL[tone]
  );
}

export function procurementRequestLaneNavChipClass(
  tone: ProcurementRequestLaneTone
): string {
  return LANE_NAV_CHIP[tone];
}

export function procurementRequestLaneNavCountClass(
  tone: ProcurementRequestLaneTone
): string {
  return LANE_NAV_COUNT[tone];
}

/** Kontener listy torów — odstępy zamiast płaskiego divide. */
export const procurementRequestLanesBodyClass = "space-y-2 p-2 sm:p-2.5";

/** Lista bloków / wierszy wewnątrz rozwiniętego toru. */
export const procurementRequestLaneContentClass = "space-y-1.5 p-1.5 sm:p-2";

/**
 * Blok dostawcy w torze — jaśniejsza karta na tintowanym tle toru
 * (unikamy podwójnego „indigo w indigo”).
 */
export function procurementRequestLaneSupplierShellClass(
  variant: "prosby" | "stockOut" = "prosby"
): string {
  if (variant === "stockOut") {
    return "overflow-hidden rounded-md border border-amber-200/70 bg-white/80 shadow-sm";
  }
  return "overflow-hidden rounded-md border border-slate-200/70 bg-white/85 shadow-sm";
}

export function procurementRequestLaneSupplierInnerListClass(
  variant: "prosby" | "stockOut" = "prosby"
): string {
  if (variant === "stockOut") {
    return "divide-y divide-amber-100/70 bg-amber-50/15";
  }
  return "divide-y divide-slate-100/90 bg-slate-50/30";
}
