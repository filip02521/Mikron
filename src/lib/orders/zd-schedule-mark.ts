/**
 * Koniec Kreatora ZD: czy zamówienie przesuwa plan dostawcy. Główne (z planu) przelicza kolejny termin tylko wtedy,
 * gdy plan wypadał dziś albo jest zaległy; poboczne (dodatkowe) i główne przed terminem zostawiają plan bez zmian.
 */

export type ZdOrderKind = "main" | "side";

/** Plan „do oznaczenia”: brak daty albo data dziś / w przeszłości. Przyszła data zostaje. */
export function isZdPlanDueForMark(nextDate: string | null | undefined, todayKey: string): boolean {
  const next = nextDate?.slice(0, 10);
  return !next || next <= todayKey.slice(0, 10);
}

export type ZdPlanStepDecision = "already_done" | "side_keeps_plan" | "cannot_mark" | "mark";

export function zdPlanStepDecision(input: {
  orderKind: ZdOrderKind;
  scheduleDone: boolean;
  /** Serwer: dostawca ma interwał, plan nie jest już oznaczony dziś i nie jest przyszły. */
  scheduleCanMark: boolean;
}): ZdPlanStepDecision {
  if (input.scheduleDone) return "already_done";
  if (input.orderKind === "side") return "side_keeps_plan";
  return input.scheduleCanMark ? "mark" : "cannot_mark";
}
