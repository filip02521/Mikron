import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { enrichMyOrderSalesUi, isMyOrderPartialStockRow } from "@/lib/orders/my-order-sales-ui";

/** Wzorzec statusu wspólny dla wielu wierszy w jednej sekcji listy. */
export type MyOrderSectionPatternId = "overdue" | "partial_ready" | "verification";

export type MyOrderSectionCalloutTone = "warning" | "sky" | "indigo";

export type MyOrderSectionCallout = {
  pattern: MyOrderSectionPatternId;
  count: number;
  title: string;
  detail: string;
  tone: MyOrderSectionCalloutTone;
};

/** Jednowierszowy hint sekcji — gdy dany wzorzec występuje tylko raz. */
export type MyOrderSectionSingleHint = {
  pattern: MyOrderSectionPatternId;
  tone: MyOrderSectionCalloutTone;
  message: string;
};

const MIN_ROWS_FOR_SECTION_CALLOUT = 2;

export const EMPTY_MY_ORDER_SECTION_PATTERNS = new Set<MyOrderSectionPatternId>();

export function polishPozycjaCount(n: number): string {
  if (n === 1) return "1 pozycja";
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} pozycje`;
  }
  return `${n} pozycji`;
}

function countByPattern(rows: MyOrderRow[]): Map<MyOrderSectionPatternId, number> {
  const counts = new Map<MyOrderSectionPatternId, number>();
  for (const row of rows) {
    const ui = enrichMyOrderSalesUi(row);
    if (ui.sortPriority === 4) {
      counts.set("overdue", (counts.get("overdue") ?? 0) + 1);
    } else if (isMyOrderPartialStockRow(row)) {
      counts.set("partial_ready", (counts.get("partial_ready") ?? 0) + 1);
    } else if (ui.sortPriority === 5) {
      counts.set("verification", (counts.get("verification") ?? 0) + 1);
    }
  }
  return counts;
}

function calloutForPattern(
  pattern: MyOrderSectionPatternId,
  count: number
): MyOrderSectionCallout {
  const label = polishPozycjaCount(count);
  switch (pattern) {
    case "overdue":
      return {
        pattern,
        count,
        tone: "warning",
        title: `Po przewidywanym terminie — ${label}`,
        detail: "Termin u dostawcy minął — czekamy na dostawę.",
      };
    case "partial_ready":
      return {
        pattern,
        count,
        tone: "sky",
        title: `Częściowa dostawa — ${label}`,
        detail: "Część towaru jest na magazynie, reszta w drodze od dostawcy.",
      };
    case "verification":
      return {
        pattern,
        count,
        tone: "indigo",
        title: `Zakupy sprawdzają szczegóły — ${label}`,
        detail: "Dział dostaw uzupełnia dane przed zamówieniem u dostawcy.",
      };
  }
}

const CALLOUT_ORDER: MyOrderSectionPatternId[] = [
  "partial_ready",
  "overdue",
  "verification",
];

function singleHintMessage(pattern: MyOrderSectionPatternId): string {
  switch (pattern) {
    case "overdue":
      return "Termin u dostawcy minął — czekamy na dostawę.";
    case "partial_ready":
      return "Część towaru jest na magazynie, reszta w drodze od dostawcy.";
    case "verification":
      return "Dział dostaw uzupełnia dane przed zamówieniem u dostawcy.";
  }
}

function deriveMyOrderSectionSingleHints(
  rows: MyOrderRow[],
  calloutPatterns: Set<MyOrderSectionPatternId>
): MyOrderSectionSingleHint[] {
  const counts = countByPattern(rows);
  const hints: MyOrderSectionSingleHint[] = [];

  for (const pattern of CALLOUT_ORDER) {
    const count = counts.get(pattern) ?? 0;
    if (count !== 1 || calloutPatterns.has(pattern)) continue;

    hints.push({
      pattern,
      tone: calloutForPattern(pattern, 1).tone,
      message: singleHintMessage(pattern),
    });
  }

  return hints;
}

/** Callouty sekcji — gdy ten sam wzorzec powtarza się w ≥2 wierszach. */
export function deriveMyOrderSectionCallouts(rows: MyOrderRow[]): MyOrderSectionCallout[] {
  const counts = countByPattern(rows);
  const callouts: MyOrderSectionCallout[] = [];

  for (const pattern of CALLOUT_ORDER) {
    const count = counts.get(pattern) ?? 0;
    if (count >= MIN_ROWS_FOR_SECTION_CALLOUT) {
      callouts.push(calloutForPattern(pattern, count));
    }
  }

  return callouts;
}

export function myOrderSectionSuppressedPatterns(
  callouts: MyOrderSectionCallout[]
): Set<MyOrderSectionPatternId> {
  return new Set(callouts.map((c) => c.pattern));
}

function rowMatchesSectionPattern(
  row: MyOrderRow,
  pattern: MyOrderSectionPatternId
): boolean {
  const ui = enrichMyOrderSalesUi(row);
  switch (pattern) {
    case "overdue":
      return ui.sortPriority === 4;
    case "partial_ready":
      return isMyOrderPartialStockRow(row);
    case "verification":
      return ui.sortPriority === 5;
  }
}

/**
 * Callouty widoczne w UI + wzorce z ukrytym nagłówkiem wiersza.
 */
export function deriveMyOrderSectionDisplayState(rows: MyOrderRow[]): {
  callouts: MyOrderSectionCallout[];
  singleHints: MyOrderSectionSingleHint[];
  suppressedPatterns: Set<MyOrderSectionPatternId>;
} {
  const callouts = deriveMyOrderSectionCallouts(rows);
  const calloutPatterns = myOrderSectionSuppressedPatterns(callouts);
  const singleHints = deriveMyOrderSectionSingleHints(rows, calloutPatterns);
  const suppressedPatterns = new Set(calloutPatterns);
  for (const hint of singleHints) {
    suppressedPatterns.add(hint.pattern);
  }

  return { callouts, singleHints, suppressedPatterns };
}

/** Ukryj powtarzający się nagłówek wiersza, gdy sekcja ma callout dla tego wzorca. */
export function myOrderRowSuppressesSharedHeadline(
  row: MyOrderRow,
  suppressed: Set<MyOrderSectionPatternId>
): boolean {
  if (suppressed.size === 0) return false;

  if (suppressed.has("overdue") && rowMatchesSectionPattern(row, "overdue")) {
    return true;
  }
  if (suppressed.has("partial_ready") && rowMatchesSectionPattern(row, "partial_ready")) {
    return true;
  }
  if (suppressed.has("verification") && rowMatchesSectionPattern(row, "verification")) {
    return true;
  }

  return false;
}
