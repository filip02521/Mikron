import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/pool", () => ({
  query: queryMock,
  isUndefinedTableError: (e: unknown) => (e as { code?: string } | null)?.code === "42P01",
}));

import { fetchZdSupplierOrderPolicy, parseZdAutoLevel, parseZdCutoffTime } from "./zd-supplier-order-policy";

const row = { strategy: "max30_90", target_days: 25, cycle_days: 7, updated_at: "2026-10-23T10:00:00Z" };

describe("parsery ustawień automatu", () => {
  it("godzina odcięcia: time z Postgresa i z inputu → HH:MM", () => {
    expect(parseZdCutoffTime("14:00:00")).toBe("14:00");
    expect(parseZdCutoffTime("9:30")).toBe("09:30");
    expect(parseZdCutoffTime("24:00")).toBeNull();
    expect(parseZdCutoffTime("")).toBeNull();
  });
  it("stopień poza 0–4 = 0", () => {
    expect(parseZdAutoLevel(3)).toBe(3);
    expect(parseZdAutoLevel(5)).toBe(0);
    expect(parseZdAutoLevel(null)).toBe(0);
  });
});

describe("fetchZdSupplierOrderPolicy", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("czyta stopień i odcięcie", async () => {
    queryMock.mockResolvedValue({ rows: [{ ...row, auto_proposals: true, auto_level: 2, cutoff_time: "10:00:00" }] });
    const p = await fetchZdSupplierOrderPolicy("s1");
    expect(p).toMatchObject({ autoProposals: true, autoLevel: 2, cutoffTime: "10:00", cycleDays: 7 });
  });

  it("baza bez migracji 194: strategia działa, propozycje = stopień 1, odcięcie 14:00", async () => {
    queryMock
      .mockRejectedValueOnce(Object.assign(new Error("column auto_level does not exist"), { code: "42703" }))
      .mockResolvedValueOnce({ rows: [{ ...row, auto_proposals: true }] });
    const p = await fetchZdSupplierOrderPolicy("s1");
    expect(p).toMatchObject({ strategy: "max30_90", autoLevel: 1, cutoffTime: "14:00" });
    expect(queryMock.mock.calls[1][0]).not.toContain("auto_level");
  });

  it("inny błąd bazy leci dalej", async () => {
    queryMock.mockRejectedValue(Object.assign(new Error("boom"), { code: "XX000" }));
    await expect(fetchZdSupplierOrderPolicy("s1")).rejects.toThrow("boom");
  });
});
