import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/pool", () => ({
  query: queryMock,
  isUndefinedTableError: (e: unknown) => (e as { code?: string } | null)?.code === "42P01",
}));

import {
  fetchZdSupplierOrderPolicy,
  parseZdAutoLevel,
  parseZdCutoffTime,
  upsertZdSupplierOrderPolicy,
} from "./zd-supplier-order-policy";

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

describe("upsertZdSupplierOrderPolicy", () => {
  const input = { supplierId: "s1", strategy: "max30_90" as const, targetDays: 25, cycleDays: 7, autoProposals: true, updatedBy: "u1" };
  const noMigration194 = async (sql: string) => {
    if (sql.includes("auto_level")) throw Object.assign(new Error("column \"auto_level\" does not exist"), { code: "42703" });
    return { rows: sql.startsWith("SELECT") ? [{ ...row, auto_proposals: true }] : [] };
  };

  beforeEach(() => {
    queryMock.mockReset();
  });

  it("baza bez migracji 194: zapis strategii bez nowych kolumn, ostrzeżenie przy stopniu > 1", async () => {
    queryMock.mockImplementation(noMigration194);
    const res = await upsertZdSupplierOrderPolicy({ ...input, autoLevel: 2, cutoffTime: "14:00" });
    const legacy = queryMock.mock.calls.filter(([sql]) => String(sql).startsWith("INSERT") && !String(sql).includes("auto_level"));
    expect(legacy).toHaveLength(1);
    expect(legacy[0][1]).toEqual(["s1", "max30_90", 25, 7, true, "u1"]);
    expect(res.policy).toMatchObject({ strategy: "max30_90", autoLevel: 1 });
    expect(res.warning).toContain("migracji 194");
  });

  it("baza bez migracji 194: ostrzeżenie przy innym odcięciu, bez ostrzeżenia dla stopnia 1 i 14:00", async () => {
    queryMock.mockImplementation(noMigration194);
    expect((await upsertZdSupplierOrderPolicy({ ...input, autoLevel: 1, cutoffTime: "10:00" })).warning).toContain("migracji 194");
    expect((await upsertZdSupplierOrderPolicy({ ...input, autoLevel: 1, cutoffTime: "14:00" })).warning).toBeNull();
  });

  it("z migracją: zapisuje stopień i odcięcie, bez ostrzeżenia; inny błąd leci dalej", async () => {
    queryMock.mockImplementation(async (sql: string) => ({
      rows: sql.startsWith("SELECT") ? [{ ...row, auto_proposals: true, auto_level: 3, cutoff_time: "10:00:00" }] : [],
    }));
    const res = await upsertZdSupplierOrderPolicy({ ...input, autoLevel: 3, cutoffTime: "10:00" });
    expect(queryMock.mock.calls[0][1]).toEqual(["s1", "max30_90", 25, 7, true, "u1", 3, "10:00"]);
    expect(res).toMatchObject({ warning: null, policy: { autoLevel: 3, cutoffTime: "10:00" } });
    queryMock.mockReset().mockRejectedValue(Object.assign(new Error("boom"), { code: "23503" }));
    await expect(upsertZdSupplierOrderPolicy({ ...input, autoLevel: 1, cutoffTime: "14:00" })).rejects.toThrow("boom");
  });
});
