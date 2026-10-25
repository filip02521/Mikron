import { describe, expect, it } from "vitest";
import { isZdAutoProposalDue } from "@/lib/data/zd-auto-proposals";
import {
  buildZdAutomatDailyStatus,
  formatAutomatDay,
  zdAutomatLastResultLabel,
  zdAutomatNextProposalKey,
  zdAutomatNightRunState,
  zdAutomatSupplierView,
  zdAutomatCycles,
  isZdAutomatWorkday,
  type ZdAutomatDailyRun,
  type ZdAutomatDailySupplier,
} from "./zd-automat-daily";

const TODAY = "2026-10-25"; // niedziela

function supplier(p: Partial<ZdAutomatDailySupplier> = {}): ZdAutomatDailySupplier {
  return {
    id: "s1",
    name: "Polkard",
    isActive: true,
    hasScope: true,
    autoProposals: true,
    cycleDays: 3,
    proposals: [],
    lastAttempt: null,
    ...p,
  };
}

// 05:10 czasu warszawskiego (UTC+1 po zmianie czasu 25.10).
const proposalAt = (key: string) => `${key}T05:10:00.000Z`;
const doneRun: ZdAutomatDailyRun = { runDate: TODAY, status: "ok", startedAt: `${TODAY}T04:31:00.000Z`, finishedAt: `${TODAY}T04:41:00.000Z` };

describe("zdAutomatNextProposalKey", () => {
  it("termin = ostatnia propozycja + cykl, gdy jeszcze nie minął", () => {
    const s = supplier({ proposals: [{ id: "p", createdAt: proposalAt("2026-10-24"), status: "accepted", lineCount: 3, valueNet: 100, dokNr: "ZD 5/10" }] });
    expect(zdAutomatNextProposalKey(s, { todayKey: TODAY, nightPassed: true })).toBe("2026-10-27");
  });

  it("termin minął: dziś, gdy dzisiejsza noc jeszcze nie przeszła, inaczej jutro (w dzień roboczy)", () => {
    const s = supplier({ proposals: [{ id: "p", createdAt: proposalAt("2026-10-20"), status: "expired", lineCount: 1, valueNet: 1, dokNr: null }] });
    const WED = "2026-10-28";
    expect(zdAutomatNextProposalKey(s, { todayKey: WED, nightPassed: false })).toBe(WED);
    expect(zdAutomatNextProposalKey(s, { todayKey: WED, nightPassed: true })).toBe("2026-10-29");
    // niedziela 25.10: dzisiejsza noc nie jest robocza — najbliższy poniedziałek
    expect(zdAutomatNextProposalKey(s, { todayKey: TODAY, nightPassed: false })).toBe("2026-10-26");
  });

  it("dni robocze: termin w weekend lub święto przechodzi na najbliższy dzień roboczy", () => {
    const at = (key: string) => [{ id: "p", createdAt: proposalAt(key), status: "accepted" as const, lineCount: 1, valueNet: 1, dokNr: null }];
    // czw 29.10 + 2 = sob 31.10 → nd 1.11 (Wszystkich Świętych) → pn 2.11
    expect(zdAutomatNextProposalKey(supplier({ cycleDays: 2, proposals: at("2026-10-29") }), { todayKey: TODAY, nightPassed: true })).toBe("2026-11-02");
    // pn 9.11 + 2 = śr 11.11 (Święto Niepodległości) → czw 12.11
    expect(zdAutomatNextProposalKey(supplier({ cycleDays: 2, proposals: at("2026-11-09") }), { todayKey: TODAY, nightPassed: true })).toBe("2026-11-12");
    expect(isZdAutomatWorkday("2026-11-11")).toBe(false);
    expect(isZdAutomatWorkday("2026-10-26")).toBe(true);
  });

  it("zgodny z warunkiem workera: w dniu terminu isZdAutoProposalDue = true, dzień wcześniej false", () => {
    const s = supplier({ cycleDays: 14, proposals: [{ id: "p", createdAt: proposalAt("2026-10-21"), status: "accepted", lineCount: 1, valueNet: 1, dokNr: null }] });
    const next = zdAutomatNextProposalKey(s, { todayKey: TODAY, nightPassed: true })!;
    expect(next).toBe("2026-11-04");
    expect(isZdAutoProposalDue({ cycleDays: 14, lastCreatedDateKey: "2026-10-21", todayKey: next })).toBe(true);
    expect(isZdAutoProposalDue({ cycleDays: 14, lastCreatedDateKey: "2026-10-21", todayKey: "2026-11-03" })).toBe(false);
  });

  it("bez propozycji i bez dzisiejszego przebiegu po 7:30 — jutro, nie „dziś 6:00”", () => {
    const st = buildZdAutomatDailyStatus({ suppliers: [supplier()], run: { ...doneRun, runDate: "2026-10-19" } }, { todayKey: TODAY, nowMinutes: 9 * 60 });
    expect(st!.detail).toContain("Następna: Polkard jutro ok. 6:00.");
  });

  it("zatrzymany automat nie ma terminu", () => {
    expect(zdAutomatNextProposalKey(supplier({ hasScope: false }), { todayKey: TODAY, nightPassed: true })).toBeNull();
    expect(zdAutomatNextProposalKey(supplier({ autoProposals: false }), { todayKey: TODAY, nightPassed: true })).toBeNull();
  });
});

describe("zdAutomatNightRunState", () => {
  it("rozróżnia: jeszcze nie ruszył, trwa, przeszedł, nie było", () => {
    expect(zdAutomatNightRunState(null, TODAY, 5 * 60).kind).toBe("not_yet");
    expect(zdAutomatNightRunState({ ...doneRun, status: "running", finishedAt: null }, TODAY, 6 * 60).kind).toBe("running");
    expect(zdAutomatNightRunState(doneRun, TODAY, 9 * 60)).toMatchObject({ kind: "done", failed: false });
    expect(zdAutomatNightRunState({ ...doneRun, runDate: "2026-10-23" }, TODAY, 9 * 60)).toEqual({ kind: "missing", lastRunDate: "2026-10-23" });
  });
});

describe("zdAutomatSupplierView", () => {
  it("dzisiejszy błąd próby jest problemem, wczorajszy nie", () => {
    const err = (at: string) => supplier({ lastAttempt: { at, kind: "error", detail: "Subiekt nie odpowiada" } });
    expect(zdAutomatSupplierView(err(`${TODAY}T04:40:00.000Z`), { todayKey: TODAY, nightPassed: true }).attemptProblem).toBe(
      "błąd: Subiekt nie odpowiada"
    );
    expect(zdAutomatSupplierView(err("2026-10-24T04:40:00.000Z"), { todayKey: TODAY, nightPassed: true }).attemptProblem).toBeNull();
  });
});

describe("buildZdAutomatDailyStatus", () => {
  const ctx = { todayKey: TODAY, nowMinutes: 9 * 60 };

  it("czekająca propozycja na pierwszym miejscu, z datą wygaśnięcia i akcją", () => {
    const s = supplier({ proposals: [{ id: "p", createdAt: proposalAt("2026-10-24"), status: "pending", lineCount: 30, valueNet: 12753, dokNr: null }] });
    const st = buildZdAutomatDailyStatus({ suppliers: [s, supplier({ id: "s2", name: "Bredent", hasScope: false })], run: doneRun }, ctx)!;
    expect(st.tone).toBe("warning");
    expect(st.headline).toBe("Propozycja Polkard czeka na decyzję");
    expect(st.detail).toContain("Od wczoraj");
    expect(st.detail).toContain("wygaśnie przy następnej (wt 27.10)");
    expect(st.action).toEqual({ kind: "review", supplierId: "s1", label: "Sprawdź propozycję" });
  });

  it("bez czekających: automat, który stoi, z powodem", () => {
    const st = buildZdAutomatDailyStatus({ suppliers: [supplier(), supplier({ id: "s2", name: "Bredent", hasScope: false })], run: doneRun }, ctx)!;
    expect(st.headline).toBe("Automat Bredent stoi");
    expect(st.detail).toMatch(/^Bredent: brak zakresu w Kreatorze ZD\. Następna: Polkard jutro ok\. 6:00\.$/);
    expect(st.action?.kind).toBe("open");
  });

  it("wszystko w porządku: zdanie z najbliższą propozycją i odmianą", () => {
    const st = buildZdAutomatDailyStatus({ suppliers: [supplier()], run: doneRun }, ctx)!;
    expect(st.tone).toBe("neutral");
    expect(st.headline).toBe("Automat ZD u 1 dostawcy: następna propozycja jutro (Polkard)");
    expect(st.detail).toContain("Nocny przebieg dziś");
  });

  it("brak dzisiejszego przebiegu po 7:30 to ostrzeżenie", () => {
    const st = buildZdAutomatDailyStatus({ suppliers: [supplier()], run: { ...doneRun, runDate: "2026-10-23" } }, ctx)!;
    expect(st.headline).toBe("Nocny przebieg automatu nie poszedł");
    expect(st.detail).toContain("ostatni pt 23.10");
  });

  it("bez dostawców w automacie — brak sekcji", () => {
    expect(buildZdAutomatDailyStatus({ suppliers: [], run: doneRun }, ctx)).toBeNull();
  });
});

describe("zdAutomatCycles", () => {
  it("jedna propozycja na dzień: zastąpione tego samego dnia nie są osobnymi cyklami", () => {
    const p = (id: string, iso: string, status: "expired" | "pending") => ({ id, createdAt: iso, status, lineCount: 1, valueNet: 1, dokNr: null });
    const cycles = zdAutomatCycles([
      p("c", "2026-10-24T15:34:00.000Z", "pending"),
      p("b", "2026-10-24T11:37:00.000Z", "expired"),
      p("a", "2026-10-23T20:05:00.000Z", "expired"),
    ]);
    expect(cycles.map((c) => c.id)).toEqual(["c", "a"]);
  });
});

describe("etykiety", () => {
  it("dni i ostatni wynik", () => {
    expect(formatAutomatDay(TODAY, TODAY)).toBe("dziś");
    expect(formatAutomatDay("2026-10-26", TODAY)).toBe("jutro");
    expect(formatAutomatDay("2026-10-24", TODAY)).toBe("wczoraj");
    expect(formatAutomatDay("2026-10-31", TODAY)).toBe("sob 31.10");
    expect(zdAutomatLastResultLabel(undefined, TODAY)).toBe("jeszcze brak");
    expect(
      zdAutomatLastResultLabel({ id: "p", createdAt: proposalAt("2026-10-21"), status: "accepted", lineCount: 1, valueNet: 1, dokNr: "ZD 512/10" }, TODAY)
    ).toBe("ZD 512/10 · śr 21.10");
  });
});

describe("kotwica cyklu (audyt K1)", () => {
  const p = (id: string, key: string, extra: Partial<ZdAutomatDailySupplier["proposals"][number]> = {}) => ({
    id,
    createdAt: proposalAt(key),
    status: "expired" as const,
    lineCount: 1,
    valueNet: 10,
    dokNr: null,
    ...extra,
  });
  it("przeliczenie w panelu i niezatwierdzone „Przygotuj teraz” nie przesuwają terminu", () => {
    const s = supplier({
      proposals: [p("r", "2026-10-26", { origin: "review" }), p("m", "2026-10-25", { origin: "manual" }), p("n", "2026-10-24", { origin: "night" })],
    });
    // Nocna 24.10 + cykl 3 = 27.10, nie 29.10 od przeliczenia.
    expect(zdAutomatNextProposalKey(s, { todayKey: TODAY, nightPassed: true })).toBe("2026-10-27");
  });
  it("zatwierdzona ręczna propozycja jest kotwicą (zamówienie złożone)", () => {
    const s = supplier({ proposals: [p("m", "2026-10-26", { origin: "manual", status: "accepted" }), p("n", "2026-10-22", { origin: "night" })] });
    expect(zdAutomatNextProposalKey(s, { todayKey: TODAY, nightPassed: true })).toBe("2026-10-29");
  });
  it("niepotwierdzone tworzenie ZD — osobny komunikat i etykieta", () => {
    const pending = p("x", TODAY, { status: "pending", origin: "night", createAttemptedAt: `${TODAY}T08:00:00.000Z` });
    const st = buildZdAutomatDailyStatus({ suppliers: [supplier({ proposals: [pending] })], run: doneRun }, { todayKey: TODAY, nowMinutes: 9 * 60 });
    expect(st?.headline).toBe("Tworzenie ZD Polkard niepotwierdzone");
    expect(zdAutomatLastResultLabel(pending, TODAY)).toBe("tworzenie ZD niepotwierdzone · dziś");
  });
});
