import { describe, expect, it } from "vitest";
import type { ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import { buildZdAutomatStatus, zdAutomatReadiness, type ZdAutomatRow } from "@/lib/orders/zd-automat-status";

const week = (over: { oos?: number | null; corr?: number | null; proposals?: number } = {}): ZdKpiWeeklyMetrics =>
  ({
    oosA: { pct: "oos" in over ? over.oos : 1, zeroDays: 0, skuDays: 100 },
    humanCorrection: { pct: over.corr ?? 3, changedValue: 0, proposalValue: 0, proposals: over.proposals ?? 1, addedLines: 0 },
  }) as unknown as ZdKpiWeeklyMetrics;
const row = (name: string, weeks: ZdKpiWeeklyMetrics[], autoLevel = 1): ZdAutomatRow => ({ name, automat: { autoLevel, cycleDays: 7 }, weeks });

describe("gotowość do auto-zatwierdzania", () => {
  it("4 tygodnie z korektą poniżej 10% — gotowy; 3 — w drodze", () => {
    expect(zdAutomatReadiness(row("A", [week(), week(), week(), week()]))).toEqual({ kind: "ready" });
    expect(zdAutomatReadiness(row("A", [week(), week(), week()]))).toEqual({ kind: "progress", weeksOk: 3 });
  });
  it("seria liczy się od najnowszego tygodnia; korekta dokładnie 10% przerywa", () => {
    expect(zdAutomatReadiness(row("A", [week({ corr: 10 }), week(), week(), week()]))).toEqual({
      kind: "not_yet",
      reason: "korekta 10% ≥ 10%",
    });
    expect(zdAutomatReadiness(row("A", [week(), week({ proposals: 0, corr: null }), week(), week()]))).toEqual({ kind: "progress", weeksOk: 1 });
  });
  it("stopień 3+ już ustawiony; dostawca poza automatem — bez gotowości", () => {
    expect(zdAutomatReadiness(row("A", [], 3))).toEqual({ kind: "auto" });
    expect(zdAutomatReadiness({ name: "B", automat: null, weeks: [week()] })).toBeNull();
  });
});

describe("zdanie stanu", () => {
  it("alarm braków A od 5% wygrywa i wymienia dostawców", () => {
    const s = buildZdAutomatStatus([row("Denon", [week({ oos: 5 })]), row("Polkard", [week({ oos: 4.9 })])], true);
    expect(s.tone).toBe("warning");
    expect(s.headline).toBe("1 dostawca ma braki A od 5%");
    expect(s.detail.startsWith("Denon — sprawdź")).toBe(true);
  });
  it("bez alarmów: liczba dostawców w automacie, polscy spoza automatu się nie liczą", () => {
    const s = buildZdAutomatStatus([row("A", [week()]), row("B", [week()]), { name: "C", automat: null, weeks: [week({ oos: 50 })] }], true);
    expect(s.tone).toBe("success");
    expect(s.headline).toBe("Automat bez alarmów: braki A poniżej 5% u 2 dostawców");
  });
  it("bez historii stanów nie twierdzi, że braki są niskie", () => {
    const s = buildZdAutomatStatus([row("A", [week({ oos: null })]), row("B", [week({ oos: null })])], true);
    expect(s.tone).toBe("neutral");
    expect(s.headline).toBe("2 dostawcy w automacie — braki A jeszcze bez pomiaru");
  });
  it("KPI jeszcze nie policzone; nikt w automacie", () => {
    expect(buildZdAutomatStatus([row("A", [])], false).headline).toBe("1 dostawca w automacie — KPI jeszcze nie policzone");
    expect(buildZdAutomatStatus([], true).headline).toBe("Żaden dostawca nie jest jeszcze w automacie");
  });
});
