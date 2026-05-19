import { describe, expect, it } from "vitest";
import {
  buildPlacementMap,
  cloneWeekDays,
  collectPlanShiftChanges,
  movePlannerItem,
} from "./week-planner-draft";
import type { WeekDayPlan } from "./summary-workspace";
import type { SummaryStandardItem } from "./summary";

function item(id: string, name: string): SummaryStandardItem {
  return {
    kind: "standard",
    supplierId: id,
    supplierName: name,
    flaggedName: name,
    location: "POLSKA",
    nextDate: new Date("2026-05-18"),
    vacationNote: null,
    notes: "Pon (18.05)",
    shift: "-",
    status: "-",
    sourceSheet: "POLSKA",
    scheduleId: `sch-${id}`,
  };
}

function day(dateKey: string, items: SummaryStandardItem[]): WeekDayPlan {
  const d = new Date(`${dateKey}T12:00:00`);
  return {
    dateKey,
    weekdayLabel: "Pon",
    dateLabel: "18.05",
    isToday: false,
    isPast: false,
    items,
  };
}

describe("week-planner-draft", () => {
  const base = [
    day("2026-05-18", [item("a", "Alfa")]),
    day("2026-05-19", [item("b", "Beta")]),
    day("2026-05-20", []),
  ];

  it("movePlannerItem przenosi między kolumnami", () => {
    const next = movePlannerItem(cloneWeekDays(base), "a", "2026-05-20");
    expect(next[0]!.items).toHaveLength(0);
    expect(next[2]!.items.map((i) => i.supplierId)).toEqual(["a"]);
  });

  it("collectPlanShiftChanges wykrywa różnice względem oryginału", () => {
    const original = buildPlacementMap(base);
    const draft = movePlannerItem(cloneWeekDays(base), "b", "2026-05-18");
    const changes = collectPlanShiftChanges(original, draft);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      supplierId: "b",
      manualDateIso: "2026-05-18",
      fromDateKey: "2026-05-19",
    });
  });
});
