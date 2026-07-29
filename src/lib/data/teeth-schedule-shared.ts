/** Etykiety dni tygodnia harmonogramu zębów — bezpieczne dla klienta. */

import type { DayOfWeek, VacationNote } from "@/types/database";

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  1: "Poniedziałek",
  2: "Wtorek",
  3: "Środa",
  4: "Czwartek",
  5: "Piątek",
};

export const DAY_OF_WEEK_SHORT: Record<DayOfWeek, string> = {
  1: "Pn",
  2: "Wt",
  3: "Śr",
  4: "Cz",
  5: "Pt",
};

export type TeethSupplierLaneSnapshot = {
  supplierId: string;
  computedNextDate: string | null;
  shiftDate: string | null;
  lastOrderDate: string | null;
  orderDayOfWeek: DayOfWeek | null;
  intervalWeeks: number | null;
  vacationNote: VacationNote | null;
};
