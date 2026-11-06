/**
 * Klasy świata Serwisu (DESIGN-serwis.md): karta serwisowa z rubrykami. Używane tylko pod `.serwis-world`.
 */

/** Etykieta rubryki: krój formularza — Inter Tight, drobne wersaliki z rozstrzeleniem, jak nadruk na karcie. */
// design-ok: wersaliki rubryk karty serwisowej (DESIGN-serwis.md → Typografia)
export const rubricLabelClass = "font-display text-[0.6875rem] font-semibold uppercase tracking-[0.07em] text-slate-600";

/** Rubryka karty: białe pole z cienką linią formularza; treść w środku z normalnym odstępem. */
export const rubricBoxClass = "rounded-lg border border-[var(--sv-rule)] bg-card";

/** Nagłówek rubryki — pasek z etykietą nad treścią, oddzielony linią rubryki. */
export const rubricHeadClass = "flex min-h-10 items-center justify-between gap-2 border-b border-[var(--sv-rule)] px-3 py-1.5";

/** Filtr na tablicy: kontrolka (nie karta) — licznik i nazwa w jednej linii. */
export const serwisFilterIdleClass =
  "border-[var(--sv-rule)] bg-transparent text-slate-700 hover:border-slate-400 hover:bg-card";
export const serwisFilterActiveClass = "border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-inset ring-indigo-600";

/** Etykieta pola formularza w Serwisie: ten sam krój rubryki, nad polem. */
export const fieldLabelClass = `mb-1.5 block ${rubricLabelClass}`;
/** Jak wyżej, bez odstępu pod spodem (etykieta w wierszu z innym elementem). */
export const fieldLabelInlineClass = `block ${rubricLabelClass}`;
