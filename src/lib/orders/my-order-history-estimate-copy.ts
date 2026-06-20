/** Etykiety terminu z historii dostaw na /moje (bez terminu ZD w Subiekcie). */

export const MY_ORDER_HISTORY_ESTIMATE_CAPTION = "Z historii";

export const MY_ORDER_HISTORY_ESTIMATE_TITLE = "Termin z historii dostaw";

export function formatMyOrderHistoryEstimateLineLabel(
  detail: string,
  options?: { lowConfidence?: boolean }
): string {
  const base = `Z historii: ${detail}`;
  return options?.lowConfidence ? `${base} (orientacyjnie)` : base;
}

export const MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL =
  "Część pozycji bez terminu w ZD — szacunek z historii przy produkcie.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_META_TITLE =
  "Termin z historii już minął — brak aktualnej informacji o planowanej dostawie.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_PENDING_DETAIL =
  "Termin z historii minął — szukamy aktualnego terminu w dokumencie ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_NO_MATCH_DETAIL =
  "Sprawdziliśmy dokumenty ZD u dostawcy — brak terminu realizacji. Termin z historii już minął.";

export const MY_ORDER_HISTORY_ESTIMATE_BELOW_ZD_NO_MATCH_DETAIL =
  "Sprawdziliśmy dokumenty ZD u dostawcy — brak terminu realizacji dla tej pozycji. Poniżej termin z historii dostaw.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_DETAIL =
  "Termin z historii minął — nie mamy aktualnej daty planowanej dostawy u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_OVERDUE_TOOLTIP =
  "Brak terminu w ZD u dostawcy — termin z historii już minął.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_TOOLTIP =
  "Brak terminu w ZD u dostawcy — poniżej termin z historii dostaw.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_OVERDUE_TOOLTIP =
  "Termin z historii minął — trwa sprawdzanie terminu w ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_TOOLTIP =
  "Termin z historii dostaw — trwa sprawdzanie terminu w ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL =
  "Termin z historii może zostać zastąpiony datą z dokumentu ZD u dostawcy.";

export const MY_ORDER_NO_HISTORY_ESTIMATE_YET_SUBLINE =
  "Termin ustalimy na podstawie historii dostaw";

export const MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL =
  "Mało dostaw w historii — termin jest orientacyjny.";

/** Sufiks w timingLabel przy małej liczbie próbek w historii. */
export const MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_SUFFIX =
  " (mało historii — orientacyjnie)";
