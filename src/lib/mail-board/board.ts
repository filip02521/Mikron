/**
 * Tablica spraw (Poczta dostawców) — w której kolumnie jest sprawa. Czyste funkcje, bez bazy.
 *
 * Bez ręcznego wpisu kolumna wynika z poczty (odpowiedź dostawcy → do zrobienia, moja odpowiedź → czekam).
 * Ręczna kolumna wygrywa, ale tablica nie może „zgnić”: nowa wiadomość w sprawie odłożonej (czekam,
 * zakończone) wraca do Do zrobienia, moja odpowiedź przenosi do Czekam, a minięty termin „wróć do tego”
 * — znowu do Do zrobienia.
 */

import { isBusinessDay } from "@/lib/orders/business-calendar";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

export const BOARD_COLUMNS = ["todo", "doing", "waiting", "to_pay", "done"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  todo: "Do zrobienia",
  doing: "W trakcie",
  waiting: "Czekam",
  to_pay: "Do zapłaty",
  done: "Zakończone",
};

/** Po mojej odpowiedzi sprawa czeka tyle dni roboczych, potem wraca do Do zrobienia. */
export const WAIT_BUSINESS_DAYS = 3;

export function isBoardColumn(v: unknown): v is BoardColumn {
  return typeof v === "string" && (BOARD_COLUMNS as readonly string[]).includes(v);
}

/** Ręczny wpis z bazy (mail_board_items). */
export type BoardRow = {
  column: BoardColumn | null;
  columnSetAt: string | null;
  note: string;
  waitingOn: string;
  remindOn: string | null;
  assigneeId: string | null;
};

const keyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Data (YYYY-MM-DD) po `days` dniach roboczych od `fromKey` — bez weekendów i polskich świąt. */
export function addBusinessDaysKey(fromKey: string, days: number): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  for (let left = days; left > 0; ) {
    day.setDate(day.getDate() + 1);
    if (isBusinessDay(day)) left--;
  }
  return keyOf(day);
}

/** Termin „wróć do tego” po odpowiedzi wysłanej w chwili `iso`. */
export function waitUntilAfter(iso: string): string {
  return addBusinessDaysKey(warsawDateKeyFromIso(iso), WAIT_BUSINESS_DAYS);
}

export type DerivedColumn = {
  column: BoardColumn;
  remindOn: string | null;
  /** Dlaczego sprawa wróciła albo przeszła sama (np. „Nowa wiadomość”). */
  reason: string | null;
  /** Nowa wiadomość od ręcznego ustawienia, a sprawa i tak jest w W trakcie / Do zapłaty. */
  fresh: boolean;
};

export function deriveColumn(input: {
  /** Kolumna z samej poczty. */
  auto: { column: BoardColumn; remindOn: string | null; reason?: string | null };
  /** Ostatnia wiadomość od dostawcy (ISO). */
  lastIncomingAt: string | null;
  /** Ostatnia nasza odpowiedź w sprawie (ISO). */
  repliedAt: string | null;
  row: BoardRow | null;
  today: string;
}): DerivedColumn {
  const { auto, lastIncomingAt, repliedAt, row, today } = input;
  let column = auto.column;
  let remindOn = row?.remindOn ?? auto.remindOn;
  let reason = auto.reason ?? null;
  let fresh = false;

  if (row?.column) {
    column = row.column;
    remindOn = row.remindOn;
    reason = null;
    const setAt = row.columnSetAt ?? "";
    const repliedAfter = Boolean(repliedAt && repliedAt > setAt);
    const incomingAfter = Boolean(lastIncomingAt && lastIncomingAt > setAt && (!repliedAt || lastIncomingAt > repliedAt));
    if (incomingAfter && (column === "waiting" || column === "done")) {
      column = "todo";
      reason = "Nowa wiadomość";
    } else if (incomingAfter) {
      fresh = true;
    } else if (repliedAfter && column !== "done" && column !== "to_pay") {
      column = "waiting";
      remindOn = waitUntilAfter(repliedAt!);
    }
  }

  if (column === "waiting" && remindOn && remindOn <= today) {
    column = "todo";
    reason = `Minął termin ${remindOn.slice(8, 10)}.${remindOn.slice(5, 7)}`;
  }
  return { column, remindOn: column === "waiting" ? remindOn : null, reason, fresh };
}
