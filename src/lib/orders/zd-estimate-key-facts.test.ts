import { describe, expect, it } from "vitest";
import {
  zdCoverageNeed,
  zdIntervalLabel,
  zdNextOrderDistance,
  zdNextOrderFact,
  zdStockDayPresets,
} from "./zd-estimate-key-facts";

const today = "2026-11-09"; // poniedziałek

describe("fakty Kreatora: kolejne zamówienie", () => {
  it("data z planu: względnie, z liczbą dni; zaległe ujemne", () => {
    expect(zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-13", onDemand: false })).toEqual({
      kind: "planned",
      date: "2026-11-13",
      days: 4,
      label: "pt 13.11",
    });
    expect(zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-09", onDemand: false })).toMatchObject({ days: 0, label: "dziś" });
    expect(zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-06T00:00:00", onDemand: false })).toMatchObject({ days: -3 });
    expect(zdNextOrderFact({ todayKey: today, computedNextDate: null, onDemand: false })).toEqual({ kind: "none" });
    expect(zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-13", onDemand: true })).toEqual({ kind: "on_demand" });
    expect(zdNextOrderDistance(4)).toBe("za 4 dni");
    expect(zdNextOrderDistance(1)).toBe("za 1 dzień");
    expect(zdNextOrderDistance(0)).toBe("zamówienie na dziś");
    expect(zdNextOrderDistance(-3)).toBe("zaległe 3 dni");
  });

  it("interwał po ludzku", () => {
    expect(zdIntervalLabel({ unit: "weeks", value: 1 })).toBe("co tydzień");
    expect(zdIntervalLabel({ unit: "weeks", value: 2 })).toBe("co 2 tyg.");
    expect(zdIntervalLabel({ unit: "months", value: 1 })).toBe("co miesiąc");
    expect(zdIntervalLabel(null)).toBeNull();
  });
});

describe("fakty Kreatora: czy zapas starczy do kolejnej dostawy", () => {
  const twoWeeks = { unit: "weeks" as const, value: 2 };

  it("kolejne zamówienie w przyszłości: do niego plus dostawa", () => {
    const next = zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-23", onDemand: false });
    expect(zdCoverageNeed({ next, interval: twoWeeks, leadDays: 10, stockDays: 20 })).toEqual({ needDays: 24, untilNextDays: 14, short: true });
    expect(zdCoverageNeed({ next, interval: twoWeeks, leadDays: 10, stockDays: 30 })).toMatchObject({ short: false });
  });

  it("plan na dziś albo zaległy: dziś składamy, kolejne za interwał", () => {
    const next = zdNextOrderFact({ todayKey: today, computedNextDate: "2026-11-05", onDemand: false });
    expect(zdCoverageNeed({ next, interval: { unit: "months", value: 1 }, leadDays: 5, stockDays: 60 })).toEqual({
      needDays: 35,
      untilNextDays: 30,
      short: false,
    });
  });

  it("bez danych: na żądanie albo ani planu, ani interwału", () => {
    expect(zdCoverageNeed({ next: { kind: "on_demand" }, interval: twoWeeks, leadDays: 5, stockDays: 10 })).toBeNull();
    expect(zdCoverageNeed({ next: { kind: "none" }, interval: null, leadDays: 5, stockDays: 10 })).toBeNull();
  });

  it("szybki wybór zapasu zawiera bieżącą wartość", () => {
    expect(zdStockDayPresets(60)).toEqual([30, 45, 60, 90, 120]);
    expect(zdStockDayPresets(75)).toEqual([30, 45, 60, 75, 90, 120]);
  });
});
