import { addDays, getISOWeek, getISOWeekYear, startOfWeek, subWeeks } from "date-fns";
import { formatDateString, parseDateOnly } from "@/lib/orders/dates";

/** Job id w `mail_job_definitions` / `mail_send_log` (wspólne z OnTime Raporty). */
export const IVOCLAR_WEEKLY_JOB_ID = "ivoclar_weekly";

export type IvoclarWeeklyPeriod = {
  periodKey: string;
  periodLabel: string;
  dataOd: string;
  dataDo: string;
};

/** Poprzedni pełny tydzień ISO (pn–nd) względem daty „dziś” (YYYY-MM-DD, Warszawa). */
export function previousCompleteIsoWeekRange(todayDateKey: string): {
  dataOd: string;
  dataDo: string;
} {
  const today = parseDateOnly(todayDateKey);
  if (!today) {
    throw new Error("Nieprawidłowa data (Warszawa).");
  }
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const prevMonday = subWeeks(thisMonday, 1);
  return {
    dataOd: formatDateString(prevMonday),
    dataDo: formatDateString(addDays(prevMonday, 6)),
  };
}

export function computeIvoclarWeeklyPeriod(todayDateKey: string): IvoclarWeeklyPeriod {
  const range = previousCompleteIsoWeekRange(todayDateKey);
  const dataDoDate = parseDateOnly(range.dataDo)!;
  const isoYear = getISOWeekYear(dataDoDate);
  const isoWeek = getISOWeek(dataDoDate);
  const periodKey = `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
  const periodLabel = `${range.dataOd} – ${range.dataDo} (${periodKey})`;
  return {
    periodKey,
    periodLabel,
    dataOd: range.dataOd,
    dataDo: range.dataDo,
  };
}
