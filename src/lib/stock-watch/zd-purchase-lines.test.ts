import { describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn(async () => ({ rows: [], rowCount: 2 })));
vi.mock("@/lib/db/pool", () => ({ query: queryMock }));

import { upsertZdPurchaseLines } from "./data";

describe("upsertZdPurchaseLines", () => {
  it("parametryzuje każdą wartość ($1…$14 dla dwóch linii)", async () => {
    const line = { subiektTwId: 10, dokId: 77, dokNr: "ZD 77", dokDate: "2026-09-03", khId: 5, qty: 40, priceNet: 50 };
    await upsertZdPurchaseLines([line, { ...line, subiektTwId: 11, priceNet: null }]);
    const [sql, params] = queryMock.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("($1, $2, $3, $4::date, $5, $6, $7, now()), ($8, $9, $10, $11::date, $12, $13, $14, now())");
    expect(params).toEqual([77, 10, "ZD 77", "2026-09-03", 5, 40, 50, 77, 11, "ZD 77", "2026-09-03", 5, 40, null]);
  });
});
