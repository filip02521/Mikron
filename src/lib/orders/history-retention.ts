import {
  DATA_RETENTION_MONTHS,
  dataRetentionCutoffDateOnly,
  dataRetentionCutoffIso,
} from "@/lib/data/data-retention";

/** Ile miesięcy historii trzymamy w bazie i na ekranie /historia. */
export const HISTORY_RETENTION_MONTHS = DATA_RETENTION_MONTHS;

/** Ile wpisów pokazujemy na stronie przed „Pokaż więcej”. */
export const HISTORY_PREVIEW_COUNT = 6;

const TERMINAL_STATUSES = ["Zrealizowane", "Anulowane"] as const;

export type HistoryTerminalStatus = (typeof TERMINAL_STATUSES)[number];

export function historyRetentionCutoffIso(now = new Date()): string {
  return dataRetentionCutoffIso(now);
}

export function historyRetentionCutoffDateOnly(now = new Date()): string {
  return dataRetentionCutoffDateOnly(now);
}

export function isHistoryTerminalStatus(status: string): status is HistoryTerminalStatus {
  return (TERMINAL_STATUSES as readonly string[]).includes(status);
}

export const HISTORY_TERMINAL_STATUSES: readonly HistoryTerminalStatus[] = TERMINAL_STATUSES;
