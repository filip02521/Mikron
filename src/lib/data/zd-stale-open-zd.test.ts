import { describe, expect, it } from "vitest";
import { applyStaleOpenZdToLine, isZdStaleOpenDoc } from "@/lib/data/zd-stale-open-zd";

const today = "2026-10-28";

describe("isZdStaleOpenDoc", () => {
  it("otwarte ZD po terminie + karencja 7 dni → zaległe; w karencji → nie", () => {
    expect(isZdStaleOpenDoc({ status: 6, termin: "2026-10-20", dokDate: "2026-10-02" }, today)).toBe(true);
    expect(isZdStaleOpenDoc({ status: 6, termin: "2026-10-21", dokDate: "2026-10-02" }, today)).toBe(false);
    expect(isZdStaleOpenDoc({ status: 6, termin: "2026-10-29", dokDate: "2026-10-27" }, today)).toBe(false);
  });

  it("bez terminu: zaległe po 60 dniach od wystawienia", () => {
    expect(isZdStaleOpenDoc({ status: 5, termin: null, dokDate: "2026-08-20" }, today)).toBe(true);
    expect(isZdStaleOpenDoc({ status: 5, termin: null, dokDate: "2026-09-10" }, today)).toBe(false);
    expect(isZdStaleOpenDoc({ status: 5, termin: null, dokDate: null }, today)).toBe(false);
  });

  it("ZD zrealizowane (8) nigdy nie jest zaległe", () => {
    expect(isZdStaleOpenDoc({ status: 8, termin: "2026-01-01", dokDate: "2025-12-01" }, today)).toBe(false);
    expect(isZdStaleOpenDoc({ status: null, termin: "2026-01-01", dokDate: "2025-12-01" }, today)).toBe(false);
  });
});

describe("applyStaleOpenZdToLine", () => {
  const stale = { units: 3, docs: [{ dokId: 1, dokNr: "ZD 29/M/10/2026", dokDate: "2026-10-02", termin: "2026-10-23", units: 3 }] };

  it("odejmuje zaległe od otwartych ZD i dopisuje meta", () => {
    const out = applyStaleOpenZdToLine({ tw_Id: 396, otwarteZd: 5 }, stale);
    expect(out.otwarteZd).toBe(2);
    expect(out.staleOpenZd?.units).toBe(3);
  });

  it("nie odejmuje więcej, niż API policzyło (kopia może znać ZD już zamknięte)", () => {
    const out = applyStaleOpenZdToLine({ tw_Id: 396, otwarteZd: 1 }, stale);
    expect(out.otwarteZd).toBe(0);
    expect(out.staleOpenZd?.units).toBe(1);
  });

  it("bez otwartych ZD w API albo bez zaległych — linia bez zmian", () => {
    const line = { tw_Id: 396, otwarteZd: 0 };
    expect(applyStaleOpenZdToLine(line, stale)).toBe(line);
    expect(applyStaleOpenZdToLine({ tw_Id: 396, otwarteZd: 4 }, null)).toEqual({ tw_Id: 396, otwarteZd: 4 });
  });
});
