import { describe, expect, it } from "vitest";
import {
  bucketZdFlow,
  formatZdHistoryRange,
  formatZdMonthHeading,
  isInZdHistoryRange,
  resolveZdHistoryRange,
  setZdCustomRangeBound,
  zdRangeExceedsSalesHistory,
} from "./zd-product-range";

const today = "2026-11-09";

describe("zakres historii towaru", () => {
  it("gotowe okresy liczą się od dziś włącznie", () => {
    expect(resolveZdHistoryRange({ preset: "1m" }, null, today)).toEqual({ from: "2026-10-11", to: today });
    expect(resolveZdHistoryRange({ preset: "12m" }, null, today)).toEqual({ from: "2025-11-10", to: today });
    expect(resolveZdHistoryRange({ preset: "all" }, null, today)).toEqual({ from: null, to: today });
  });

  it("okno zapasu: okno sprzedaży, ale nie krócej niż miesiąc", () => {
    expect(resolveZdHistoryRange({ preset: "window" }, { dataOd: "2026-08-01", dataDo: "2026-11-08" }, today)).toEqual({
      from: "2026-08-01",
      to: "2026-11-08",
    });
    expect(resolveZdHistoryRange({ preset: "window" }, { dataOd: "2026-11-01", dataDo: "2026-11-08" }, today)).toEqual({
      from: "2026-10-10",
      to: "2026-11-08",
    });
  });

  it("własny przedział: odwrócone daty zamienia, brak daty uzupełnia", () => {
    expect(resolveZdHistoryRange({ preset: "custom", customFrom: "2026-09-30", customTo: "2026-09-01" }, null, today)).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(resolveZdHistoryRange({ preset: "custom", customFrom: "2026-01-15" }, null, today)).toEqual({ from: "2026-01-15", to: today });
    expect(resolveZdHistoryRange({ preset: "custom", customTo: "2026-06-30" }, null, today)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("zmiana granicy zapisuje uporządkowany przedział: kolejna zmiana „Od” nie gubi „Do”", () => {
    // „Od” 20.10 przy „Do” 01.10 — pola pokazują 01.10–20.10 i tak też trafia do stanu.
    const swapped = setZdCustomRangeBound({ from: "2026-09-01", to: "2026-10-01" }, "from", "2026-10-20");
    expect(swapped).toEqual({ preset: "custom", customFrom: "2026-10-01", customTo: "2026-10-20" });
    const range = resolveZdHistoryRange(swapped, null, today);
    expect(setZdCustomRangeBound(range, "from", "2026-09-15")).toEqual({ preset: "custom", customFrom: "2026-09-15", customTo: "2026-10-20" });
    expect(setZdCustomRangeBound(range, "to", "")).toEqual({ preset: "custom", customFrom: "2026-10-01", customTo: undefined });
  });

  it("filtr, podpis i ostrzeżenie o 12 miesiącach sprzedaży", () => {
    const r = { from: "2026-08-01", to: "2026-10-31" };
    expect(isInZdHistoryRange("2026-08-01", r)).toBe(true);
    expect(isInZdHistoryRange("2026-11-01", r)).toBe(false);
    expect(isInZdHistoryRange(null, r)).toBe(false);
    expect(formatZdHistoryRange(r)).toBe("01.08–31.10.2026");
    expect(formatZdHistoryRange({ from: "2025-12-01", to: "2026-01-31" })).toBe("01.12.2025–31.01.2026");
    expect(zdRangeExceedsSalesHistory(r, today)).toBe(false);
    expect(zdRangeExceedsSalesHistory({ from: null, to: today }, today)).toBe(true);
    expect(zdRangeExceedsSalesHistory({ from: "2025-06-01", to: today }, today)).toBe(true);
    expect(formatZdMonthHeading("2026-11-04")).toBe("listopad 2026");
  });
});

describe("oś przyjęć i rozchodu", () => {
  it("krótki zakres w tygodniach od poniedziałku, puste tygodnie zostają, zwrot pomniejsza sprzedaż", () => {
    const { unit, buckets } = bucketZdFlow(
      [
        { date: "2026-10-14", kind: "in", pieces: 10 },
        { date: "2026-10-15", kind: "out", pieces: 4 },
        { date: "2026-10-16", kind: "out", pieces: -1 },
        { date: "2026-10-30", kind: "zd", pieces: 12 },
        { date: "2026-09-01", kind: "out", pieces: 99 },
      ],
      { from: "2026-10-12", to: "2026-11-01" }
    );
    expect(unit).toBe("week");
    expect(buckets.map((b) => b.start)).toEqual(["2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(buckets[0]).toMatchObject({ inPieces: 10, outPieces: 3, zdPieces: 0 });
    expect(buckets[1]).toMatchObject({ inPieces: 0, outPieces: 0 });
    expect(buckets[2]).toMatchObject({ zdPieces: 12 });
  });

  it("długi zakres w miesiącach; cała historia zaczyna się od najstarszego zdarzenia", () => {
    const { unit, buckets } = bucketZdFlow(
      [
        { date: "2025-10-20", kind: "in", pieces: 5 },
        { date: "2026-02-03", kind: "out", pieces: 2 },
      ],
      { from: null, to: "2026-03-10" }
    );
    expect(unit).toBe("month");
    expect(buckets.map((b) => b.label)).toEqual(["paź 25", "lis", "gru", "sty 26", "lut", "mar"]);
    expect(buckets[4]!.outPieces).toBe(2);
    expect(buckets[0]!.inPieces).toBe(5);
  });

  it("historia dłuższa niż 130 miesięcy: oś kończy się na końcu zakresu, odpadają najstarsze miesiące", () => {
    const { buckets } = bucketZdFlow(
      [
        { date: "2012-03-05", kind: "in", pieces: 1 },
        { date: "2026-11-02", kind: "out", pieces: 7 },
      ],
      { from: null, to: "2026-11-09" }
    );
    expect(buckets).toHaveLength(130);
    expect(buckets[buckets.length - 1]).toMatchObject({ start: "2026-11-01", outPieces: 7 });
    expect(buckets[0]!.start).toBe("2016-02-01");
  });
});
