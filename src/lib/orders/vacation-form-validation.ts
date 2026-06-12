import { parseDateOnly } from "./dates";
import {
  parseVacationPeriodRow,
  vacationRangesOverlap,
} from "./vacations";

export type VacationFormInput = {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

export type VacationFormValidation = {
  error: string | null;
  warning: string | null;
};

type VacationOverlapRow = {
  id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
};

/** Walidacja dat urlopu przed zapisem lub podglądem. */
export function validateVacationFormInput(
  form: VacationFormInput,
  todayKey: string
): VacationFormValidation {
  const start = parseDateOnly(form.start_date);
  const end = parseDateOnly(form.end_date);
  const lastOrder = parseDateOnly(form.last_order_date);
  if (!start || !end || !lastOrder) {
    return { error: "Podaj poprawne daty urlopu (od, do, ostatnie zamówienie).", warning: null };
  }

  if (start > end) {
    return { error: "Data „urlop od” nie może być późniejsza niż „urlop do”.", warning: null };
  }
  if (lastOrder > start) {
    return {
      error:
        "„Ostatnie zamówienie przed urlopem” powinno być w dniu rozpoczęcia urlopu lub wcześniej.",
      warning: null,
    };
  }

  if (form.active && form.end_date < todayKey) {
    return {
      error:
        "Nie można aktywować urlopu, którego koniec minął. Wyłącz urlop lub wydłuż okres.",
      warning: null,
    };
  }

  return { error: null, warning: null };
}

/** Sprawdza nakładanie się z innymi aktywnymi urlopami tego dostawcy. */
export function validateVacationOverlap(
  form: VacationFormInput,
  existingRows: VacationOverlapRow[]
): string | null {
  if (!form.active) return null;

  const candidate = parseVacationPeriodRow({
    start_date: form.start_date,
    end_date: form.end_date,
    last_order_date: form.last_order_date,
  });
  if (!candidate) return null;

  for (const row of existingRows) {
    if (form.id && row.id === form.id) continue;
    const other = parseVacationPeriodRow(row);
    if (!other) continue;
    if (vacationRangesOverlap(candidate, other)) {
      return "Ten dostawca ma już aktywny urlop w tym okresie. Edytuj istniejący wpis zamiast dodawać kolejny.";
    }
  }
  return null;
}
