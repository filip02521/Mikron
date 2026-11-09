/**
 * Koniec Kreatora ZD: czy zamówienie przesuwa plan dostawcy. Główne zapisuje zamówienie w planie i przelicza kolejny
 * termin od dziś (także przed planowaną datą); uzupełniające zostawia plan bez zmian. Domyślny wybór: główne, gdy plan
 * wypada dziś albo jest zaległy, inaczej uzupełniające.
 */

export type ZdOrderKind = "main" | "side";

/** Plan „na teraz”: brak daty albo data dziś / w przeszłości — wtedy domyślnie zamówienie główne. */
export function isZdPlanDueForMark(nextDate: string | null | undefined, todayKey: string): boolean {
  const next = nextDate?.slice(0, 10);
  return !next || next <= todayKey.slice(0, 10);
}

/** Domyślny rodzaj zamówienia, zanim użytkownik wybierze sam. */
export function zdDefaultOrderKind(input: { scheduleCanMark: boolean; scheduleDue: boolean }): ZdOrderKind {
  return input.scheduleCanMark && input.scheduleDue ? "main" : "side";
}

export type ZdPlanStepDecision = "already_done" | "side_keeps_plan" | "cannot_mark" | "mark";

export function zdPlanStepDecision(input: {
  orderKind: ZdOrderKind;
  scheduleDone: boolean;
  /** Serwer: dostawca ma interwał i plan nie jest już oznaczony dziś. */
  scheduleCanMark: boolean;
}): ZdPlanStepDecision {
  if (input.scheduleDone) return "already_done";
  if (input.orderKind === "side") return "side_keeps_plan";
  return input.scheduleCanMark ? "mark" : "cannot_mark";
}
