import { describe, expect, it } from "vitest";
import type { ZdKpiWeeklyMetrics } from "@/lib/data/zd-kpi-weekly";
import {
  buildZdAutomatCheckStatus,
  buildZdAutomatStatus,
  zdAutomatCheckReasons,
  zdAutomatReadiness,
  type ZdAutomatCheckInput,
  type ZdAutomatRow,
} from "@/lib/orders/zd-automat-status";

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

describe("do sprawdzenia", () => {
  const now = new Date("2026-10-24T12:00:00.000Z").getTime();
  const at = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
  const check = (over: Partial<ZdAutomatCheckInput> = {}): ZdAutomatCheckInput => ({
    name: "Polkard",
    inAutomat: true,
    backtest: { status: "done", verdict: "works", at: at(3) },
    oosAlert: false,
    ...over,
  });

  it("świeży backtest „działa” bez alarmu — nic do sprawdzenia; poza automatem — nigdy", () => {
    expect(zdAutomatCheckReasons(check(), now)).toEqual([]);
    expect(zdAutomatCheckReasons(check({ inAutomat: false, backtest: null, oosAlert: true }), now)).toEqual([]);
  });

  it("alarm braków, brak / błąd backtestu, werdykt inny niż „działa”, backtest starszy niż 90 dni", () => {
    expect(zdAutomatCheckReasons(check({ oosAlert: true }), now)).toEqual(["braki A od 5%"]);
    expect(zdAutomatCheckReasons(check({ backtest: null }), now)).toEqual(["brak backtestu"]);
    expect(zdAutomatCheckReasons(check({ backtest: { status: "error", verdict: null, at: at(1) } }), now)).toEqual(["błąd backtestu"]);
    expect(zdAutomatCheckReasons(check({ backtest: { status: "done", verdict: "tradeoff", at: at(94) } }), now)).toEqual([
      "backtest „kompromis”",
      "backtest sprzed 94 dni",
    ]);
    expect(zdAutomatCheckReasons(check({ backtest: { status: "done", verdict: "works", at: at(90) } }), now)).toEqual([]);
  });

  it("automat stoi: dostawca nieaktywny albo bez zakresu w Kreatorze (nocny przebieg go pomija)", () => {
    expect(zdAutomatCheckReasons(check({ active: false }), now)).toEqual(["nieaktywny w karcie - automat stoi"]);
    expect(zdAutomatCheckReasons(check({ hasScope: false }), now)).toEqual(["bez zakresu w Kreatorze - automat stoi"]);
    expect(zdAutomatCheckReasons(check({ inAutomat: false, active: false }), now)).toEqual([]);
  });

  it("backtest dla innych ustawień niż bieżące nie potwierdza strategii", () => {
    const done = { status: "done" as const, verdict: "works" as const, at: at(3), params: { cycleDays: 14, targetDays: 25 } };
    expect(zdAutomatCheckReasons(check({ backtest: done, policy: { cycleDays: 14, targetDays: 40 } }), now)).toEqual([
      "backtest dla innych ustawień (co 14 / cel 25)",
    ]);
    expect(zdAutomatCheckReasons(check({ backtest: done, policy: { cycleDays: 14, targetDays: 25 } }), now)).toEqual([]);
  });

  it("liczący się backtest to wynik w drodze, nie powód", () => {
    expect(zdAutomatCheckReasons(check({ backtest: { status: "running", verdict: null, at: at(0) } }), now)).toEqual([]);
  });

  it("zdanie stanu: liczba z liczby w automacie, trzech wymienionych, reszta zliczona", () => {
    expect(buildZdAutomatCheckStatus([check()], now)).toBeNull();
    const s = buildZdAutomatCheckStatus(
      [
        check({ name: "A", backtest: null }),
        check({ name: "B", oosAlert: true }),
        check({ name: "C", backtest: null }),
        check({ name: "D", backtest: null }),
        check({ name: "E" }),
        check({ name: "Poza", inAutomat: false, backtest: null }),
      ],
      now
    );
    expect(s?.count).toBe(4);
    expect(s?.headline).toBe("4 z 5 dostawców w automacie do sprawdzenia");
    expect(s?.detail).toBe("A: brak backtestu · B: braki A od 5% · C: brak backtestu · i 1 inny.");
  });
});
