import { describe, expect, it } from "vitest";
import {
  daysBetween,
  groupLoanersByModel,
  loanerSpans,
  loanerStats,
  loanerViewState,
  nextLoanerCode,
  normalizeLoanerCode,
  type LoanerEvent,
} from "./service-loaners";

const TODAY = new Date(2026, 10, 3, 15, 0);
const ev = (id: number, at: string, type: LoanerEvent["type"], extra: Partial<LoanerEvent> = {}): LoanerEvent => ({
  id,
  unitId: "u1",
  at,
  type,
  khId: null,
  clientName: null,
  plannedReturn: null,
  condition: null,
  note: "",
  actorName: null,
  ...extra,
});

describe("loanerViewState", () => {
  it("free, svc and retired come from status", () => {
    expect(loanerViewState({ status: "na_stanie", currentSince: null, plannedReturn: null }, TODAY)).toBe("free");
    expect(loanerViewState({ status: "przeglad", currentSince: null, plannedReturn: null }, TODAY)).toBe("svc");
    expect(loanerViewState({ status: "wycofany", currentSince: null, plannedReturn: null }, TODAY)).toBe("retired");
  });
  it("at client: late after planned return, warn after 14 days", () => {
    const base = { status: "u_klienta" as const };
    expect(loanerViewState({ ...base, currentSince: "2026-10-30T10:00:00", plannedReturn: "2026-11-13" }, TODAY)).toBe("out");
    expect(loanerViewState({ ...base, currentSince: "2026-10-03T10:00:00", plannedReturn: "2026-11-07" }, TODAY)).toBe("warn");
    expect(loanerViewState({ ...base, currentSince: "2026-10-30T10:00:00", plannedReturn: "2026-11-02" }, TODAY)).toBe("late");
    expect(loanerViewState({ ...base, currentSince: "2026-10-30T10:00:00", plannedReturn: "2026-11-03" }, TODAY)).toBe("out");
  });
});

describe("daysBetween", () => {
  it("counts calendar days regardless of hours", () => {
    expect(daysBetween("2026-11-02T23:50:00", "2026-11-03T00:10:00")).toBe(1);
    expect(daysBetween(new Date(2026, 9, 17), TODAY)).toBe(17);
  });
});

describe("loanerSpans", () => {
  const events = [
    ev(5, "2026-10-23T09:00:00", "issued", { clientName: "Dent-Art, Kraków", plannedReturn: "2026-11-06" }),
    ev(1, "2026-08-28T09:00:00", "issued", { clientName: "Lab. Bialdent", plannedReturn: "2026-09-11" }),
    ev(2, "2026-09-19T12:00:00", "returned"),
    ev(3, "2026-09-20T08:00:00", "service_start"),
    ev(4, "2026-09-23T08:00:00", "service_end"),
    ev(6, "2026-11-01T09:00:00", "extended", { plannedReturn: "2026-11-13" }),
  ];
  it("rebuilds stints and service spans in order", () => {
    const { stints, service } = loanerSpans(events);
    expect(stints).toEqual([
      { clientName: "Lab. Bialdent", from: "2026-08-28T09:00:00", to: "2026-09-19T12:00:00", plannedReturn: "2026-09-11" },
      { clientName: "Dent-Art, Kraków", from: "2026-10-23T09:00:00", to: null, plannedReturn: "2026-11-13" },
    ]);
    expect(service).toEqual([{ from: "2026-09-20T08:00:00", to: "2026-09-23T08:00:00" }]);
  });
  it("computes stats from stints", () => {
    const { stints } = loanerSpans(events);
    expect(loanerStats({ createdAt: "2026-08-01T00:00:00" }, stints, TODAY)).toEqual({
      issues: 2,
      avgDaysOut: 17,
      utilizationPct: 35,
    });
  });
});

describe("codes", () => {
  it("normalizes and generates the next ZAST number", () => {
    expect(normalizeLoanerCode("  zast-7 ")).toBe("ZAST-7");
    expect(nextLoanerCode(["ZAST-001", "SN MK-0518", "zast-012"])).toBe("ZAST-013");
    expect(nextLoanerCode([])).toBe("ZAST-001");
  });
});

describe("groupLoanersByModel", () => {
  it("groups by Subiekt product and sorts by name", () => {
    const g = groupLoanersByModel([
      { subiektTwId: 2, twName: "Prostnica Forte 200" },
      { subiektTwId: 1, twName: "Mikrosilnik 50k" },
      { subiektTwId: 2, twName: "Prostnica Forte 200" },
    ]);
    expect(g.map((x) => [x.name, x.units.length])).toEqual([
      ["Mikrosilnik 50k", 1],
      ["Prostnica Forte 200", 2],
    ]);
  });
});
