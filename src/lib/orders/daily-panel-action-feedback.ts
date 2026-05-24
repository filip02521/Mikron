import { createAdminClient } from "@/lib/supabase/admin";
import { formatPlDate, formatSupplierInterval, vacationNoteLabel } from "@/lib/display-labels";
import { resolveSupplierInterval } from "@/lib/orders/dates";

export type DailyPanelScheduleOutcome = {
  supplierName: string;
  nextOrderDate: string | null;
  intervalLabel: string;
  hasInterval: boolean;
  scheduleAdjusted: boolean;
  vacationNote: string | null;
};

export type DailyPanelScheduleFeedbackAction =
  | "GLOWNE"
  | "POBOCZNE"
  | "ZAMOWIONE"
  | "PRZESUNIETE";

export const MAX_SCHEDULE_FEEDBACK_LINES = 5;

export function formatScheduleOutcomeLines(
  outcomes: DailyPanelScheduleOutcome[],
  action: DailyPanelScheduleFeedbackAction
): string[] {
  if (!outcomes.length) return [];

  return outcomes.map((o) => {
    const intervalPart = o.hasInterval
      ? `Interwał: ${o.intervalLabel}.`
      : "Uwaga: brak interwału u dostawcy — sprawdź kartę w ustawieniach.";

    const datePart = o.nextOrderDate
      ? `Kolejne zamówienie planowe: ${formatPlDate(o.nextOrderDate)}.`
      : "Brak daty kolejnego zamówienia — sprawdź interwał i harmonogram.";

    const vac =
      o.vacationNote && o.vacationNote !== "—"
        ? ` ${vacationNoteLabel(o.vacationNote)}.`
        : "";

    if (action === "ZAMOWIONE") {
      return `${o.supplierName}: zamówienie zapisane · harmonogram przeliczony. ${datePart} ${intervalPart}${vac}`;
    }

    if (action === "PRZESUNIETE") {
      return `${o.supplierName}: termin przesunięty. ${datePart} ${intervalPart}${vac}`;
    }

    if (action === "GLOWNE" && o.scheduleAdjusted) {
      return `${o.supplierName}: oznaczono główne · harmonogram przeliczony. ${datePart} ${intervalPart}${vac}`;
    }

    if (action === "POBOCZNE") {
      return `${o.supplierName}: uzupełniające (harmonogram bez zmian). ${datePart} ${intervalPart}${vac}`;
    }

    return `${o.supplierName}: ${datePart} ${intervalPart}${vac}`;
  });
}

export function mapSupplierRowsToOutcomes(
  rows: Array<{
    id: string;
    name: string;
    interval_raw: string | null;
    interval_weeks: number | null;
    supplier_schedules:
      | {
          computed_next_date: string | null;
          vacation_note: string | null;
        }
      | Array<{
          computed_next_date: string | null;
          vacation_note: string | null;
        }>
      | null;
  }>,
  adjustedSupplierIds: Set<string>
): DailyPanelScheduleOutcome[] {
  return rows.map((s) => {
    const schedule = Array.isArray(s.supplier_schedules)
      ? s.supplier_schedules[0]
      : s.supplier_schedules;
    const interval = resolveSupplierInterval(
      s.interval_raw,
      s.interval_weeks != null ? Number(s.interval_weeks) : null
    );
    const intervalLabel = formatSupplierInterval(s.interval_raw, s.interval_weeks);

    return {
      supplierName: s.name,
      nextOrderDate: schedule?.computed_next_date ?? null,
      intervalLabel,
      hasInterval: interval !== null,
      scheduleAdjusted: adjustedSupplierIds.has(s.id),
      vacationNote: schedule?.vacation_note ?? null,
    };
  });
}

function truncateFeedbackLines(lines: string[]): string[] {
  if (lines.length <= MAX_SCHEDULE_FEEDBACK_LINES) return lines;
  return [
    ...lines.slice(0, MAX_SCHEDULE_FEEDBACK_LINES),
    `… i ${lines.length - MAX_SCHEDULE_FEEDBACK_LINES} kolejnych — szczegóły na liście po odświeżeniu.`,
  ];
}

/** Podgląd harmonogramu po akcji w panelu dziennym (toast z cofnięciem). */
export async function buildScheduleFeedback(
  supplierIds: string[],
  action: DailyPanelScheduleFeedbackAction,
  adjustedSupplierIds?: Set<string>
): Promise<string[]> {
  const unique = [...new Set(supplierIds)];
  if (!unique.length) return [];

  const adjusted = adjustedSupplierIds ?? new Set(unique);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select(
      "id, name, interval_raw, interval_weeks, supplier_schedules(computed_next_date, vacation_note)"
    )
    .in("id", unique);

  if (error || !data?.length) return [];

  const outcomes = mapSupplierRowsToOutcomes(data, adjusted);
  return truncateFeedbackLines(formatScheduleOutcomeLines(outcomes, action));
}
