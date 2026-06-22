/**
 * Spójne komunikaty UI dla terminów ZD na /moje (sync, pending, brak dopasowania).
 * Używaj tych stałych zamiast lokalnych wariantów w komponentach.
 */

/** Badge — pełny stan oczekiwania na sync ZD. */
export const ZD_ETA_PENDING_BADGE_LABEL = "Sprawdzamy termin…";

/** Badge — obok szacunku z historii lub przy już dopasowanym ZD w grupie. */
export const ZD_ETA_PENDING_COMPACT_BADGE = "Sprawdzamy ZD…";

export const ZD_ETA_PENDING_TITLE =
  "Szukamy dokumentu zamówienia do dostawcy (ZD) w Subiekcie i odczytujemy termin realizacji.";

/** Meta „brak terminu” — primary + detail (DeliveryDateMetaValue). */
export const ZD_ETA_NO_MATCH_PRIMARY_LABEL = "Brak terminu w ZD";

export const ZD_ETA_NO_MATCH_DETAIL_LABEL = "u dostawcy";

export const ZD_ETA_NO_MATCH_TITLE =
  "Sprawdziliśmy dokumenty ZD u dostawcy — brak terminu realizacji dla tej pozycji.";

/** Nagłówek rozwiniętej karty — sync w toku. */
export const ZD_ETA_TIMING_TITLE_PENDING = "Sprawdzamy termin w ZD";

export const ZD_ETA_TIMING_DETAIL_PENDING =
  "Szukamy dokumentu ZD u dostawcy w Subiekcie.";

export const ZD_ETA_TIMING_DETAIL_PENDING_WITH_ESTIMATE =
  "Termin z historii może zostać zastąpiony datą z dokumentu ZD u dostawcy.";

export const ZD_ETA_TIMING_SYNC_IN_PROGRESS = "Trwa synchronizacja z Subiektem…";

/** Nagłówek rozwiniętej karty — brak dopasowania. */
export const ZD_ETA_TIMING_TITLE_NO_MATCH = "Brak terminu w ZD u dostawcy";

/** Szczegół przy mieszanym stanie grupy (część pozycji ma ZD, część nie). */
export const ZD_ETA_MIXED_GROUP_PENDING_DETAIL =
  "Część pozycji czeka na synchronizację terminu w ZD u dostawcy.";

/** Subline nagłówka karty — po terminie, sync w toku. */
export const ZD_ETA_OVERDUE_PENDING_SUBLINE = "Sprawdzamy termin w ZD u dostawcy…";

/** Subline nagłówka karty — po terminie, brak ZD. */
export const ZD_ETA_OVERDUE_NO_MATCH_SUBLINE =
  "Brak terminu w ZD — szacujemy z historii dostaw.";

/** Etykieta wiersza produktu — oczekiwanie na sync. */
export const ZD_ETA_LINE_PENDING_LABEL = "Sprawdzamy termin w ZD u dostawcy…";

/** Etykieta wiersza produktu — brak terminu po sync. */
export const ZD_ETA_LINE_NO_MATCH_LABEL = "Brak terminu w ZD u dostawcy";

/** Podpowiedź na zwiniętej karcie grupy — tylko pozycje oczekujące. */
export function buildCollapsedZdPendingOnlyHint(count: number): string {
  if (count === 1) return "1 pozycja czeka na termin w ZD — rozwiń po szczegóły";
  if (count >= 2 && count <= 4) {
    return `${count} pozycje czekają na termin w ZD — rozwiń po szczegóły`;
  }
  return `${count} pozycji czeka na termin w ZD — rozwiń po szczegóły`;
}
