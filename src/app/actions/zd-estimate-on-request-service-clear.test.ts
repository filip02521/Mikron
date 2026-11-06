import { beforeEach, describe, expect, it, vi } from "vitest";

const deleted: number[][] = [];
const manualRow = (subiektTwId: number, note: string) => ({
  subiektTwId,
  twSymbol: null,
  twNazwa: `Towar ${subiektTwId}`,
  grtId: null,
  grtNazwa: null,
  note,
  createdAt: "",
  updatedAt: "",
  createdBy: null,
});

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "u1" })),
  requireZdEstimateAdmin: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/data/zd-product-pairs", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-product-pairs")>()),
  fetchZdProductPairs: vi.fn(async () => []),
}));
// Baza: ręczne wpisy — 30 to część serwisowa z własną notatką, 40 zwykły towar.
vi.mock("@/lib/data/zd-estimate-on-request", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-estimate-on-request")>()),
  fetchZdEstimateOnRequests: vi.fn(async () => [manualRow(30, "ważna notatka"), manualRow(40, "")]),
  deleteZdEstimateOnRequestsMany: vi.fn(async (ids: number[]) => {
    deleted.push(ids);
  }),
}));
// Podmieniona tylko baza: rozpoznanie cechy i scalanie listy (fetchZdEstimateOnRequestsWithServiceParts)
// działają naprawdę — cecha 2858 = „Części serwisowe”, mają ją towary 30 i 50.
vi.mock("@/lib/db/pool", async (orig) => ({
  ...(await orig<typeof import("@/lib/db/pool")>()),
  hasDatabaseConfig: () => true,
  query: vi.fn(async (sql: string) => {
    if (sql.includes("FROM app_settings")) return { rows: [] };
    if (sql.includes("FROM subiekt_scope_names")) return { rows: [{ scope_id: 2858, name: "Części serwisowe" }] };
    if (sql.includes("FROM subiekt_product_scope_index")) return { rows: [{ subiekt_tw_id: 30 }, { subiekt_tw_id: 50 }] };
    throw new Error(`nieoczekiwane zapytanie: ${sql.slice(0, 60)}`);
  }),
}));

import { actionClearZdEstimateOnRequest, actionClearZdEstimateOnRequestProducts } from "./zd-estimate";

describe("zdjęcie „tylko na prośbę” z części serwisowej", () => {
  beforeEach(() => {
    deleted.length = 0;
  });

  it("pojedynczo: ręczny wpis części z cechą — odmowa i nic nie skasowane (notatka zostaje)", async () => {
    const res = await actionClearZdEstimateOnRequest(30);
    expect(res.ok).toBe(false);
    expect(deleted).toEqual([]);
  });

  it("pojedynczo: część tylko z cechy — odmowa", async () => {
    expect((await actionClearZdEstimateOnRequest(50)).ok).toBe(false);
    expect(deleted).toEqual([]);
  });

  it("zbiorczo: kasuje tylko zwykły wpis, części serwisowe w błędach", async () => {
    const res = await actionClearZdEstimateOnRequestProducts([30, 40, 50]);
    expect(deleted.flat()).toEqual([40]);
    expect(res.ok && res.succeededTwIds).toEqual([40]);
    expect(res.ok && res.failed.map((f) => f.subiektTwId).sort()).toEqual([30, 50]);
  });
});
