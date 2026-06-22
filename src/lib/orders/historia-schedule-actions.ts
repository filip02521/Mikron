import { snapToBusinessDay } from "@/lib/orders/business-calendar";
import { parseDateOnly, formatDateString } from "@/lib/orders/dates";
import { warsawDateKeyFromIso } from "@/lib/time/warsaw";

export type HistoriaScheduleActionKind = "ordered" | "shift" | "ignore";

function normalizeHistoriaActionText(action: string): string {
  return action
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l");
}

/** Klasyfikacja AKCJA z arkusza HISTORIA (jak w panelu dziennym). */
export function classifyHistoriaAction(action: string): HistoriaScheduleActionKind {
  const a = normalizeHistoriaActionText(action);

  if (a === "zamowione") return "ordered";
  if (a.startsWith("zamowienie glowne")) return "ordered";
  if (a.startsWith("przesuniete o ")) return "shift";
  if (a.startsWith("recznie przesuniete")) return "shift";

  return "ignore";
}

export type HistoriaScheduleEvent = {
  actionAt: Date;
  action: string;
  nextDate: Date | null;
};

function orderDateFromHistoriaActionAt(actionAt: Date): Date | null {
  const key = warsawDateKeyFromIso(actionAt.toISOString());
  return parseDateOnly(key) ?? parseDateOnly(formatDateString(actionAt));
}

/** Odtwarza order_date / shift_date przez chronologiczną historię (jak serie kliknięć w UI). */
export function replayHistoriaScheduleState(events: HistoriaScheduleEvent[]): {
  orderDate: Date | null;
  shiftDate: Date | null;
  /** DATA NAST. ZAM. z ostatniej akcji Zamówione / Przesunięte (jak w arkuszu). */
  sheetNextDate: Date | null;
} {
  const sorted = [...events].sort((a, b) => a.actionAt.getTime() - b.actionAt.getTime());
  let orderDate: Date | null = null;
  let shiftDate: Date | null = null;
  let sheetNextDate: Date | null = null;

  for (const e of sorted) {
    const kind = classifyHistoriaAction(e.action);
    if (kind === "ordered") {
      orderDate = orderDateFromHistoriaActionAt(e.actionAt);
      shiftDate = null;
      sheetNextDate = e.nextDate ? snapToBusinessDay(e.nextDate) : sheetNextDate;
    } else if (kind === "shift") {
      const target = e.nextDate ? snapToBusinessDay(e.nextDate) : null;
      if (target) {
        shiftDate = target;
        sheetNextDate = target;
      }
    }
  }

  return { orderDate, shiftDate, sheetNextDate };
}

export function parseHistoriaActionAt(isoOrDate: string): Date | null {
  if (!isoOrDate) return null;
  const d = new Date(isoOrDate);
  if (!Number.isNaN(d.getTime())) return d;
  return parseDateOnly(isoOrDate.slice(0, 10));
}

/** Daty kliknięć „Zamówione” w historii dostawcy (kalendarz Warszawy). */
export function supplierOrderDatesFromHistoria(
  rows: readonly { action_at: string; action: string }[]
): string[] {
  const dates: string[] = [];
  for (const row of rows) {
    if (classifyHistoriaAction(row.action) !== "ordered") continue;
    const actionAt = parseHistoriaActionAt(row.action_at);
    if (!actionAt) continue;
    const key = warsawDateKeyFromIso(actionAt.toISOString());
    if (key) dates.push(key);
  }
  return [...new Set(dates)];
}
