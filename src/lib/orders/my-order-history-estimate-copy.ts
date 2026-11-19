/** Etykiety terminu z historii dostaw na /moje (bez terminu ZD w Subiekcie). */

export const MY_ORDER_HISTORY_ESTIMATE_CAPTION = "Z historii";

export const MY_ORDER_HISTORY_ESTIMATE_TITLE = "Termin z historii dostaw";

/** Tytuł bloku, gdy szacunek z historii minął i nie ma czym go zastąpić. */
export const MY_ORDER_NO_CURRENT_ETA_TITLE = "Brak aktualnego terminu";

export function formatMyOrderHistoryEstimateLineLabel(
  detail: string,
  options?: { lowConfidence?: boolean }
): string {
  const base = `Z historii: ${detail}`;
  return options?.lowConfidence ? `${base} (orientacyjnie)` : base;
}

export const MY_ORDER_HISTORY_ESTIMATE_MIXED_ZD_GROUP_DETAIL =
  "Część pozycji bez terminu w ZD - szacunek z historii przy produkcie.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_META_TITLE =
  "Termin z historii już minął - brak aktualnej informacji o planowanej dostawie.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_PENDING_DETAIL =
  "Termin z historii minął - szukamy aktualnego terminu w dokumencie ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_ZD_NO_MATCH_DETAIL =
  "W dokumencie ZD u dostawcy nie ma terminu, a termin z historii już minął.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_DETAIL =
  "Dostawca nie podał terminu w zamówieniu (ZD), więc datę szacujemy z poprzednich dostaw.";

export const MY_ORDER_HISTORY_ESTIMATE_OVERDUE_DETAIL =
  "Termin z historii minął - nie mamy aktualnej daty planowanej dostawy u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_OVERDUE_TOOLTIP =
  "Brak terminu w ZD u dostawcy - termin z historii już minął.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_NO_MATCH_TOOLTIP =
  "Brak terminu w ZD u dostawcy - pokazujemy termin z historii dostaw.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_OVERDUE_TOOLTIP =
  "Termin z historii minął - trwa sprawdzanie terminu w ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_TOOLTIP =
  "Termin z historii dostaw - trwa sprawdzanie terminu w ZD u dostawcy.";

export const MY_ORDER_HISTORY_ESTIMATE_ZD_PENDING_REPLACE_DETAIL =
  "Sprawdzamy jeszcze termin w zamówieniu do dostawcy (ZD). Jeśli go znajdziemy, zastąpi tę datę.";

export const MY_ORDER_NO_HISTORY_ESTIMATE_YET_SUBLINE =
  "Termin ustalimy na podstawie historii dostaw";

export const MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_DETAIL =
  "Mało dostaw w historii - termin jest orientacyjny.";

/** Sufiks w timingLabel przy małej liczbie próbek w historii. */
export const MY_ORDER_HISTORY_ESTIMATE_LOW_CONFIDENCE_SUFFIX =
  " (mało historii - orientacyjnie)";

export const MY_ORDER_HISTORY_ESTIMATE_SAME_DAY_DETAIL =
  "U tego dostawcy towar często dociera tego samego dnia roboczego.";

export const MY_ORDER_HISTORY_ESTIMATE_NEXT_MORNING_DETAIL =
  "U tego dostawcy typowy czas to ok. 1 dzień roboczy (często nazajutrz).";

/** Znacznik pewności pod datą na zwiniętej karcie — szacunek z historii dostawcy, nie termin z ZD. */
export const MY_ORDER_HISTORY_ESTIMATE_CERTAINTY_TAG = "≈ szacunek";

/** Znacznik pewności pod datą — termin potwierdzony w dokumencie ZD. */
export const ZD_DELIVERY_CERTAINTY_TAG = "z ZD";
