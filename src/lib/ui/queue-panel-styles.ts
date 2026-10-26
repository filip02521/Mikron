/** Przewijana lista w karcie magazynu (~60–70 pozycji bez scrollowania całej strony). */
export const QUEUE_LIST_BODY_CLASS =
  "max-h-[min(60vh,30rem)] overflow-y-auto overscroll-y-contain sm:max-h-[min(70vh,34rem)]";

/** Pasek filtrów w sekcji magazynu: jeden rząd bez własnej ramki (DESIGN.md → Pasek filtrów). */
export const queueToolbarShellClass =
  "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center";

export const queueToolbarFieldLabelClass =
  "mb-0.5 block text-[0.6875rem] font-medium text-slate-600";

export const queueToolbarInputClass =
  "w-full min-h-11 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-base text-slate-900 shadow-sm placeholder:text-slate-400 hover:border-slate-300 sm:min-h-9 sm:text-sm";

/** Jednolita wysokość pól i przycisków w pasku przyjęcia. */
export const queueToolbarControlClass = "min-h-11 py-2 sm:min-h-10";

/** Karta sekcji w pasku przyjęcia towaru. */
export const receiveQueueToolbarSectionClass =
  "rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm";

/** Blok narzędzi w dzienniku dostaw (data, filtry) — blok `well` w karcie, bez ramki i cienia. */
export const journalToolbarCardClass = "rounded-lg bg-slate-50 p-3";

/** Formularz nowej dostawy w dzienniku — blok `well` w karcie. */
export const journalComposeShellClass = "rounded-lg bg-slate-50 p-4";

/** Wiersz edycji wpisu w dzienniku — tło `petrol-mist`, bez ramki i cienia. */
export const journalEditShellClass = "rounded-lg bg-indigo-50/60 p-4";

/**
 * Przycisk pomocy przy tytule strony (`PageHeader help`): sama ikona „?”, etykieta dla czytnika,
 * pole dotyku 44px na telefonie (DESIGN.md → Anatomia ekranu, Ikony).
 */
export const pageHelpIconButtonClass =
  "size-11 justify-center gap-0 border-transparent bg-transparent px-0 py-0 text-slate-500 shadow-none hover:border-transparent hover:bg-slate-100 hover:text-slate-700 sm:size-8";
