/**
 * Jedno miejsce dla znacznika „po terminie” w timingLabel — zapis i odczyt muszą używać tych funkcji,
 * żeby zmiana treści etykiety nie wyłączyła po cichu wykrywania opóźnień.
 */
export const TIMING_OVERDUE_SUFFIX = " · po terminie";

const SUFFIX_RE = /\s*·\s*po terminie\s*/gi;

export function timingOverdueSuffix(overdue: boolean): string {
  return overdue ? TIMING_OVERDUE_SUFFIX : "";
}

export function isTimingOverdue(timingLabel: string | null | undefined): boolean {
  return Boolean(timingLabel && new RegExp(SUFFIX_RE.source, "i").test(timingLabel));
}

export function stripTimingOverdue(timingLabel: string): string {
  return timingLabel.replace(SUFFIX_RE, "").trim();
}
