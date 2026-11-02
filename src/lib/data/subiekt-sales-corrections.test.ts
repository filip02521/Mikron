import { describe, expect, it } from "vitest";
import { applySalesCorrectionsToLine, subtractCorrectionsFromWindows } from "@/lib/data/subiekt-sales-corrections";

describe("applySalesCorrectionsToLine", () => {
  it("zwrot 1 szt z 8 sprzedanych: sprzedaż 7, tempo i cel w dół, zapasMin bez zmian", () => {
    // Zirconium Explore A3,5 (28.10.2026): 8 FS + KFS 95/M/10 na 1 szt; okno 28 d, 30 dni zapasu, zapasMin 2.
    const line = { sprzedazOkres: 8, sprzedazDziennie: 8 / 28, celZapasu: (8 / 28) * 30 + 2 };
    const out = applySalesCorrectionsToLine(line, 1, 28, 30, 2);
    expect(out.sprzedazOkres).toBe(7);
    expect(out.sprzedazDziennie).toBeCloseTo(7 / 28, 9);
    expect(out.celZapasu).toBeCloseTo((7 / 28) * 30 + 2, 5);
    expect(out.salesCorrections).toEqual({ pieces: 1 });
  });

  it("zwrot większy niż sprzedaż w oknie → sprzedaż 0, cel nie niżej niż zapasMin", () => {
    const out = applySalesCorrectionsToLine({ sprzedazOkres: 3, sprzedazDziennie: 0.1, celZapasu: 5 }, 10, 30, 30, 2);
    expect(out.sprzedazOkres).toBe(0);
    expect(out.celZapasu).toBe(2);
    expect(out.salesCorrections?.pieces).toBe(3);
  });

  it("bez zwrotów — linia bez zmian (ten sam obiekt)", () => {
    const line = { sprzedazOkres: 8, sprzedazDziennie: 0.3, celZapasu: 9 };
    expect(applySalesCorrectionsToLine(line, 0, 28, 30, 0)).toBe(line);
  });
});

describe("subtractCorrectionsFromWindows", () => {
  it("odejmuje zwrot z okna, w którym jest data KFS; okno nie poniżej 0", () => {
    const windows = Array(12).fill(10);
    // Okna kończą się 2026-10-28; ostatnie = 2026-09-29..2026-10-28, przedostatnie = 2026-08-30..2026-09-28.
    const out = subtractCorrectionsFromWindows(windows, [["2026-10-27", 3], ["2026-09-01", 25], ["2020-01-01", 99]], "2026-10-28");
    expect(out[11]).toBe(7);
    expect(out[10]).toBe(0);
    expect(out.slice(0, 10).every((x) => x === 10)).toBe(true);
    expect(windows[11]).toBe(10);
  });
});
