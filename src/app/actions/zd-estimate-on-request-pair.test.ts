import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = { upsert: [] as number[], deleteExclusion: [] as number[] };
let excluded = new Set<number>();

vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "u1" })),
  requireZdEstimateAdmin: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/data/zd-product-pairs", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-product-pairs")>()),
  fetchZdProductPairs: vi.fn(async () => [
    { id: "p", packTwId: 10, pieceTwId: 20, unitsPerPack: 5, packSymbol: "WOREK-25", packNazwa: "Worek 25 kg" },
  ]),
}));
vi.mock("@/lib/data/zd-estimate-exclusions", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-estimate-exclusions")>()),
  fetchZdEstimateExclusion: vi.fn(async (tw: number) => (excluded.has(tw) ? { subiektTwId: tw } : null)),
  deleteZdEstimateExclusion: vi.fn(async (tw: number) => {
    calls.deleteExclusion.push(tw);
  }),
}));
vi.mock("@/lib/data/zd-estimate-on-request", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-estimate-on-request")>()),
  upsertZdEstimateOnRequest: vi.fn(async (i: { subiektTwId: number }) => {
    calls.upsert.push(i.subiektTwId);
  }),
  fetchZdEstimateOnRequests: vi.fn(async () => []),
}));

import { actionMarkZdEstimateOnRequest, actionMarkZdEstimateOnRequestProducts } from "./zd-estimate";

describe("Na prośbę na sztuce z pary nie kasuje wykluczenia opakowania", () => {
  beforeEach(() => {
    calls.upsert = [];
    calls.deleteExclusion = [];
    excluded = new Set();
  });

  it("opakowanie wykluczone → odmowa, nic nie zapisane", async () => {
    excluded = new Set([10]);
    const res = await actionMarkZdEstimateOnRequest({ subiektTwId: 20, twNazwa: "Sztuka 5 kg" });
    expect(res.ok).toBe(false);
    expect(calls.upsert).toEqual([]);
    expect(calls.deleteExclusion).toEqual([]);
  });

  it("opakowanie niewykluczone → flaga na opakowaniu, zdjęte tylko wykluczenie sztuki", async () => {
    const res = await actionMarkZdEstimateOnRequest({ subiektTwId: 20, twNazwa: "Sztuka 5 kg" });
    expect(res.ok).toBe(true);
    expect(calls.upsert).toEqual([10]);
    expect(calls.deleteExclusion).toEqual([20]);
  });

  it("zbiorczo: sztuka z wykluczonym opakowaniem trafia do błędów", async () => {
    excluded = new Set([10]);
    const res = await actionMarkZdEstimateOnRequestProducts({
      products: [{ subiektTwId: 20, twSymbol: "S5", twNazwa: "Sztuka 5 kg", grtId: null, grtNazwa: null }],
    });
    expect(res.ok).toBe(false);
    expect(calls.upsert).toEqual([]);
  });
});

describe("zbiorczo: wynik nie zależy od kolejności zaznaczenia", () => {
  beforeEach(() => {
    calls.upsert = [];
    calls.deleteExclusion = [];
  });
  it("[sztuka, opakowanie] przy wykluczonym opakowaniu: opakowanie oznaczone, sztuka już widzi zdjęte wykluczenie", async () => {
    excluded = new Set([10]);
    const { deleteZdEstimateExclusion } = await import("@/lib/data/zd-estimate-exclusions");
    vi.mocked(deleteZdEstimateExclusion).mockImplementation(async (tw: number) => {
      calls.deleteExclusion.push(tw);
      excluded.delete(tw);
    });
    const res = await actionMarkZdEstimateOnRequestProducts({
      products: [
        { subiektTwId: 20, twSymbol: "S5", twNazwa: "Sztuka 5 kg", grtId: null, grtNazwa: null },
        { subiektTwId: 10, twSymbol: "W25", twNazwa: "Worek 25 kg", grtId: null, grtNazwa: null },
      ],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.failed).toEqual([]);
    expect(calls.upsert).toEqual([10, 10]);
  });
});
