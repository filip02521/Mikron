/** Przewijana lista w karcie magazynu (~60–70 pozycji bez scrollowania całej strony). */
export const QUEUE_LIST_BODY_CLASS =
  "max-h-[min(60vh,30rem)] overflow-y-auto overscroll-y-contain sm:max-h-[min(70vh,34rem)]";

/** Zwarty pasek filtrów / wyszukiwania w sekcji magazynu. */
export const queueToolbarShellClass =
  "flex w-full min-w-0 flex-col gap-2 rounded-md border border-emerald-100/70 bg-white p-2 shadow-sm sm:flex-row sm:items-end";

export const queueToolbarFieldLabelClass =
  "mb-0.5 block text-[11px] font-medium text-slate-600";

export const queueToolbarInputClass =
  "w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400";

/** Jednolita wysokość pól i przycisków w pasku przyjęcia. */
export const queueToolbarControlClass = "h-9 py-2 text-sm";

/** Karta sekcji w pasku przyjęcia towaru. */
export const receiveQueueToolbarSectionClass =
  "rounded-md border border-emerald-100/70 bg-white p-3 shadow-sm";

/** Karta narzędzi w dzienniku dostaw (data, filtry). */
export const journalToolbarCardClass =
  "rounded-md border border-emerald-100/70 bg-white p-3 shadow-sm";

/** Formularz nowej dostawy w dzienniku. */
export const journalComposeShellClass =
  "rounded-md border border-emerald-200/80 bg-white p-4 shadow-sm";

/** Wiersz edycji wpisu w dzienniku. */
export const journalEditShellClass =
  "rounded-md border border-indigo-200/70 bg-indigo-50/25 p-4 shadow-sm";
