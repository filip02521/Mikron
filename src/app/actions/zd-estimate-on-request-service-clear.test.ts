import { beforeEach, describe, expect, it, vi } from "vitest";

const deleted: number[][] = [];
const row = (subiektTwId: number, origin?: "service_cecha") => ({
  subiektTwId,
  twSymbol: null,
  twNazwa: `Towar ${subiektTwId}`,
  grtId: null,
  grtNazwa: null,
  note: "",
  createdAt: "",
  updatedAt: "",
  createdBy: null,
  origin,
});

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "u1" })),
  requireZdEstimateAdmin: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/data/zd-product-pairs", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-product-pairs")>()),
  fetchZdProductPairs: vi.fn(async () => []),
}));
vi.mock("@/lib/data/zd-estimate-on-request", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-estimate-on-request")>()),
  deleteZdEstimateOnRequestsMany: vi.fn(async (ids: number[]) => {
    deleted.push(ids);
  }),
}));
// Część serwisowa 30 ma też ręczny wpis z notatką; 40 to zwykły wpis ręczny.
vi.mock("@/lib/data/service-parts", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/service-parts")>()),
  fetchZdEstimateOnRequestsWithServiceParts: vi.fn(async () => [row(30, "service_cecha"), row(40)]),
}));

import { actionClearZdEstimateOnRequest, actionClearZdEstimateOnRequestProducts } from "./zd-estimate";

describe("zdjęcie „tylko na prośbę” z części serwisowej", () => {
  beforeEach(() => {
    deleted.length = 0;
  });

  it("pojedynczo: odmowa i nic nie skasowane", async () => {
    const res = await actionClearZdEstimateOnRequest(30);
    expect(res.ok).toBe(false);
    expect(deleted).toEqual([]);
  });

  it("zbiorczo: kasuje tylko zwykły wpis, część serwisowa w błędach", async () => {
    const res = await actionClearZdEstimateOnRequestProducts([30, 40]);
    expect(deleted.flat()).toEqual([40]);
    expect(res.ok && res.succeededTwIds).toEqual([40]);
    expect(res.ok && res.failed.map((f) => f.subiektTwId)).toEqual([30]);
  });
});
