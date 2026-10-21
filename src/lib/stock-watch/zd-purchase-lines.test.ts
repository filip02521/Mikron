import { describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn(async () => ({ rows: [], rowCount: 2 })));
vi.mock("@/lib/db/pool", () => ({ query: queryMock }));

import { upsertZdPurchaseLines } from "./data";

describe("upsertZdPurchaseLines", () => {
  it("jedno zapytanie z tablicami (bez limitu parametrów), duplikat (ZD, towar) raz", async () => {
    const line = { subiektTwId: 10, dokId: 77, dokNr: "ZD 77", dokDate: "2026-09-03", khId: 5, qty: 40, priceNet: 50 };
    await upsertZdPurchaseLines([line, { ...line, subiektTwId: 11, priceNet: null }, { ...line, qty: 41 }]);
    const [sql, params] = queryMock.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("unnest($1::int[], $2::int[], $3::text[], $4::date[], $5::int[], $6::numeric[], $7::numeric[])");
    expect(params).toHaveLength(7);
    expect(params[1]).toEqual([10, 11]);
    expect(params[5]).toEqual([41, 40]);
    expect(params[6]).toEqual([50, null]);
  });

  it("10 000 linii to nadal 7 parametrów", async () => {
    queryMock.mockClear();
    const rows = Array.from({ length: 10_000 }, (_, i) => ({
      subiektTwId: i + 1, dokId: 1, dokNr: null, dokDate: null, khId: null, qty: 1, priceNet: null,
    }));
    await upsertZdPurchaseLines(rows);
    const [, params] = queryMock.mock.calls[0] as unknown as [string, unknown[]];
    expect(params).toHaveLength(7);
    expect((params[0] as unknown[]).length).toBe(10_000);
  });
});
