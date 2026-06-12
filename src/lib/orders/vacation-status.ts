/** Klasyfikacja wpisów urlopów w UI (spójna z logiką harmonogramu). */

export type VacationDateRow = {
  active: boolean;
  end_date: string;
};

export function isVacationEffectivelyActive(
  row: VacationDateRow,
  todayKey: string
): boolean {
  return row.active && row.end_date >= todayKey;
}

export function isVacationHistorical(row: { end_date: string }, todayKey: string): boolean {
  return row.end_date < todayKey;
}

/** Wyłączony wpis z okresem jeszcze w przyszłości — nie wpływa na harmonogram. */
export function isVacationScheduledInactive(
  row: VacationDateRow,
  todayKey: string
): boolean {
  return !row.active && row.end_date >= todayKey;
}

export function isVacationPastArchive(row: VacationDateRow, todayKey: string): boolean {
  return isVacationHistorical(row, todayKey) || (!row.active && row.end_date < todayKey);
}
