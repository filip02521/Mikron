/** Wspólne klasy powierzchni — spójne zaokrąglenia i obramowania w całej aplikacji. */

export const surface = {
  /** Główna karta strony (Card). */
  panel: "rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]",
  /** Karta / wiersz wewnątrz sekcji. */
  nested: "rounded-md border border-slate-200 bg-white",
  /** Delikatne tło pod listą / metrykami. */
  inset: "rounded-md border border-slate-200/90 bg-slate-50/50",
  /** Przyciski, pola, segmenty. */
  control: "rounded-md",
} as const;

/** Pełnoekranowy backdrop modala. Wymaga `useBodyScrollLock(open)` — sam nie blokuje scrolla `<main>`. */
export const modalBackdropClass =
  "fixed inset-0 cursor-pointer bg-slate-900/45 backdrop-blur-sm";

export const modalPanelClass =
  "relative flex flex-col overflow-hidden rounded-md border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)] ring-1 ring-slate-900/5";

/** Prawy panel z tabelą — szerokość jak ModalShell xl / karty dostawców. */
export const sideSheetWidePanelClass =
  "flex w-full max-w-none flex-col border-l border-slate-200/90 bg-[var(--card)] shadow-[var(--shadow-card-elevated)] sm:w-[min(calc(100%-0.75rem),72rem)]";

export const choiceChipClass = {
  order:
    "flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 text-sm transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50",
  informacja:
    "flex cursor-pointer items-center gap-2 rounded-md border border-sky-200 text-sm transition has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50",
  paddingMd: "px-4 py-3",
  paddingSm: "px-3 py-2",
} as const;

export const buttonGroupShellClass =
  "inline-flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm";

/** Grupa akcji w wierszu panelu dziennego — wysokość obudowy; segmenty wypełniają przez h-full. */
export const panelActionBarShellClass =
  "inline-flex h-9 min-h-9 w-full items-stretch overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm sm:h-7 sm:min-h-7 sm:w-auto";

/** Grupa akcji w wierszu /moje — ta sama wysokość co toolbar karty (h-10). */
export const mojeActionBarShellClass =
  "inline-flex h-10 min-h-10 w-full items-stretch overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm sm:w-auto";

export const buttonGroupItemClass = "border-0 shadow-none";

/** Segment wypełnia wysokość obudowy panelActionBarShellClass. */
export const panelActionSegmentClass =
  "flex h-full min-h-0 shrink-0 items-center justify-center leading-none";

/** Układ wiersza kolejki — treść nad akcjami na wąskim ekranie. */
export const panelQueueRowLayoutClass =
  "flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2";

/** Slot akcji w wierszu — pełna szerokość na mobile. */
export const panelQueueRowActionsClass =
  "w-full border-t border-slate-100/90 pt-2 sm:w-auto sm:shrink-0 sm:border-0 sm:pt-0 sm:self-start";

/** Karta w kolumnie planu tygodnia — zawsze pionowo (kolumny są wąskie niezależnie od viewportu). */
export const weekPlannerCardLayoutClass = "flex flex-col gap-1.5";

/** Akcje w karcie planu — pełna szerokość, bez hover-expand (zero layout shift). */
export const weekPlannerCardActionsClass =
  "w-full shrink-0 border-t border-slate-100/90 pt-1.5";
