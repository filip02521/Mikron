/** Ile miesięcy historii trzymamy w bazie i na ekranie /historia. */
export const HISTORY_RETENTION_MONTHS = 6;

/** Ile wpisów pokazujemy na stronie przed „Pokaż więcej”. */
export const HISTORY_PREVIEW_COUNT = 6;

const TERMINAL_STATUSES = ["Zrealizowane", "Anulowane"] as const;

export type HistoryTerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function historyRetentionCutoffIso(now = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - HISTORY_RETENTION_MONTHS);
  return d.toISOString();
}

export function historyRetentionCutoffDateOnly(now = new Date()): string {
  return historyRetentionCutoffIso(now).slice(0, 10);
}

export function isHistoryTerminalStatus(status: string): status is HistoryTerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export const HISTORY_TERMINAL_STATUSES: readonly HistoryTerminalStatus[] = TERMINAL_STATUSES;
