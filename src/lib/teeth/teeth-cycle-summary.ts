import { formatPlDate, vacationNoteLabel } from "@/lib/display-labels";
import { DAY_OF_WEEK_SHORT } from "@/lib/data/teeth-schedule";
import { plCoTydzien } from "@/lib/ui/polish-plurals";
import type { TeethSupplierSchedule } from "@/types/database";

/** Krótka etykieta cyklu zębów dla karty dostawcy. */
export function formatTeethCycleSummary(
  schedule: TeethSupplierSchedule | undefined
): string {
  if (!schedule || !schedule.computed_next_date) return "Uzupełnij cykl";

  const parts: string[] = [];

  if (schedule.order_day_of_week != null) {
    const dayLabel = DAY_OF_WEEK_SHORT[schedule.order_day_of_week];
    if (dayLabel) parts.push(dayLabel);
  }

  if (schedule.interval_weeks != null && schedule.interval_weeks > 0) {
    parts.push(plCoTydzien(schedule.interval_weeks));
  }

  parts.push(`nast. ${formatPlDate(schedule.computed_next_date)}`);

  if (schedule.vacation_note) {
    parts.push(vacationNoteLabel(schedule.vacation_note));
  }

  return parts.join(" · ");
}
