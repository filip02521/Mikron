import { describe, expect, it } from "vitest";
import {
  buildSuppliersOnVacationNow,
  groupMatchesSupplierVacationFilter,
  isSupplierOnVacationNow,
} from "./procurement-supplier-vacation";

describe("isSupplierOnVacationNow", () => {
  const today = "2026-08-04";

  it("true gdy dziś w aktywnym oknie", () => {
    expect(
      isSupplierOnVacationNow(
        { active: true, start_date: "2026-08-01", end_date: "2026-08-10" },
        today
      )
    ).toBe(true);
  });

  it("true na granicach start/end", () => {
    expect(
      isSupplierOnVacationNow(
        { active: true, start_date: "2026-08-04", end_date: "2026-08-10" },
        today
      )
    ).toBe(true);
    expect(
      isSupplierOnVacationNow(
        { active: true, start_date: "2026-08-01", end_date: "2026-08-04" },
        today
      )
    ).toBe(true);
  });

  it("false przed startem (przyszły aktywny urlop)", () => {
    expect(
      isSupplierOnVacationNow(
        { active: true, start_date: "2026-08-05", end_date: "2026-08-20" },
        today
      )
    ).toBe(false);
  });

  it("false po end", () => {
    expect(
      isSupplierOnVacationNow(
        { active: true, start_date: "2026-07-01", end_date: "2026-08-03" },
        today
      )
    ).toBe(false);
  });

  it("false gdy active=false nawet w oknie", () => {
    expect(
      isSupplierOnVacationNow(
        { active: false, start_date: "2026-08-01", end_date: "2026-08-10" },
        today
      )
    ).toBe(false);
  });
});

describe("buildSuppliersOnVacationNow", () => {
  it("mapuje tylko dostawców na urlopie dziś", () => {
    const map = buildSuppliersOnVacationNow(
      [
        {
          supplier_id: "a",
          active: true,
          start_date: "2026-08-01",
          end_date: "2026-08-10",
        },
        {
          supplier_id: "b",
          active: true,
          start_date: "2026-09-01",
          end_date: "2026-09-10",
        },
        {
          supplier_id: "c",
          active: false,
          start_date: "2026-08-01",
          end_date: "2026-08-10",
        },
      ],
      "2026-08-04"
    );
    expect(map).toEqual({
      a: { startDate: "2026-08-01", endDate: "2026-08-10" },
    });
  });

  it("pierwsze pasujące przy duplikacie supplier_id", () => {
    const map = buildSuppliersOnVacationNow(
      [
        {
          supplier_id: "a",
          active: true,
          start_date: "2026-08-01",
          end_date: "2026-08-05",
        },
        {
          supplier_id: "a",
          active: true,
          start_date: "2026-08-03",
          end_date: "2026-08-20",
        },
      ],
      "2026-08-04"
    );
    expect(map.a).toEqual({ startDate: "2026-08-01", endDate: "2026-08-05" });
  });
});

describe("groupMatchesSupplierVacationFilter", () => {
  it("matchuje po supplierId", () => {
    const map = {
      s1: { startDate: "2026-08-01", endDate: "2026-08-10" },
    };
    expect(groupMatchesSupplierVacationFilter("s1", map)).toBe(true);
    expect(groupMatchesSupplierVacationFilter("s2", map)).toBe(false);
    expect(groupMatchesSupplierVacationFilter("", map)).toBe(false);
  });
});

describe("formatSupplierVacationRangeCompact", () => {
  it("skraca zakres do d.MM", async () => {
    const { formatSupplierVacationRangeCompact } = await import(
      "./procurement-supplier-vacation"
    );
    expect(
      formatSupplierVacationRangeCompact({
        startDate: "2026-08-01",
        endDate: "2026-08-15",
      })
    ).toBe("1.08–15.08");
  });
});
