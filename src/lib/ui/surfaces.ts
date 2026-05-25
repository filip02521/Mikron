/** Wspólne klasy powierzchni — spójne zaokrąglenia i obramowania w całej aplikacji. */

export const surface = {
  /** Główna karta strony (Card). */
  panel: "rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)]",
  /** Karta / wiersz wewnątrz sekcji. */
  nested: "rounded-xl border border-slate-200 bg-white",
  /** Delikatne tło pod listą / metrykami. */
  inset: "rounded-xl border border-slate-200/90 bg-slate-50/50",
  /** Przyciski, pola, segmenty. */
  control: "rounded-xl",
} as const;

export const modalBackdropClass =
  "fixed inset-0 cursor-pointer bg-slate-900/45 backdrop-blur-sm";

export const modalPanelClass =
  "relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-card-elevated)] ring-1 ring-slate-900/5";

export const choiceChipClass = {
  order:
    "flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 text-sm transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50",
  informacja:
    "flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 text-sm transition has-[:checked]:border-sky-500 has-[:checked]:bg-sky-50",
  paddingMd: "px-4 py-3",
  paddingSm: "px-3 py-2",
} as const;

export const buttonGroupShellClass =
  "inline-flex items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

export const buttonGroupItemClass =
  "!rounded-none border-0 shadow-none";
