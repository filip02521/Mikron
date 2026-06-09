import type { MyOrderInboxFilter } from "@/lib/orders/my-order-inbox-filter";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { enrichMyOrderSalesUi } from "@/lib/orders/my-order-sales-ui";

/** Wzorzec statusu wspólny dla wielu wierszy w jednej sekcji listy. */
export type MyOrderSectionPatternId = "overdue" | "partial_ready" | "verification";

export type MyOrderSectionCalloutTone = "warning" | "emerald" | "indigo";

export type MyOrderSectionCallout = {
  pattern: MyOrderSectionPatternId;
  count: number;
  title: string;
  detail: string;
  tone: MyOrderSectionCalloutTone;
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
    } else if (ui.sortPriority === 2 && ui.headline === "Część towaru możesz już odebrać") {
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
        detail:
          "Poniżej terminy u dostawców. Magazyn powiadomi, gdy towar będzie do odbioru.",
      };
    case "partial_ready":
      return {
        pattern,
        count,
        tone: "emerald",
        title: `Część towaru na magazynie — ${label}`,
        detail: "Przy każdej pozycji sprawdź, co możesz już odebrać — zielony przycisk.",
      };
    case "verification":
      return {
        pattern,
        count,
        tone: "indigo",
        title: `Zakupy sprawdzają szczegóły — ${label}`,
        detail: "Nie musisz nic robić — damy znać, gdy ruszy zamówienie u dostawcy.",
      };
  }
}

const CALLOUT_ORDER: MyOrderSectionPatternId[] = [
  "partial_ready",
  "overdue",
  "verification",
];

/** Callouty sekcji — tylko gdy ten sam wzorzec powtarza się w ≥2 wierszach. */
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

const FILTER_HIDES_PATTERN: Partial<Record<MyOrderInboxFilter, MyOrderSectionPatternId>> = {
  overdue: "overdue",
  partial: "partial_ready",
  verification: "verification",
};

/** Gdy filtr już zawęża listę do danego wzorca, callout sekcji jest zbędny. */
export function filterSectionCalloutsForInboxFilter(
  callouts: MyOrderSectionCallout[],
  activeFilter: MyOrderInboxFilter | null
): MyOrderSectionCallout[] {
  if (!activeFilter) return callouts;
  const hidden = FILTER_HIDES_PATTERN[activeFilter];
  if (!hidden) return callouts;
  return callouts.filter((c) => c.pattern !== hidden);
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
      return ui.sortPriority === 2 && ui.headline === "Część towaru możesz już odebrać";
    case "verification":
      return ui.sortPriority === 5;
  }
}

/**
 * Callouty widoczne w UI + wzorce z ukrytym nagłówkiem wiersza.
 * Przy filtrze homogenicznym (np. „Po terminie”) nagłówki są ukrywane także bez calloutu.
 */
export function deriveMyOrderSectionDisplayState(
  rows: MyOrderRow[],
  activeFilter: MyOrderInboxFilter | null
): {
  callouts: MyOrderSectionCallout[];
  suppressedPatterns: Set<MyOrderSectionPatternId>;
} {
  const callouts = filterSectionCalloutsForInboxFilter(
    deriveMyOrderSectionCallouts(rows),
    activeFilter
  );
  const suppressedPatterns = myOrderSectionSuppressedPatterns(callouts);

  const filterPattern = activeFilter ? FILTER_HIDES_PATTERN[activeFilter] : undefined;
  if (
    filterPattern &&
    rows.length >= MIN_ROWS_FOR_SECTION_CALLOUT &&
    rows.every((row) => rowMatchesSectionPattern(row, filterPattern))
  ) {
    suppressedPatterns.add(filterPattern);
  }

  return { callouts, suppressedPatterns };
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
