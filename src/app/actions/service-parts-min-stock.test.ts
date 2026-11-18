import { beforeEach, describe, expect, it, vi } from "vitest";

// Część serwisowa 501 (dane wymyślone); zakupy albo serwis mogą już mieć dla niej minimum.
const { existing, upsert } = vi.hoisted(() => ({
  existing: { current: null as null | { minStockSzt: number; note: string } },
  upsert: vi.fn(async (_input: unknown) => undefined),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireServicePanel: vi.fn(async () => ({ id: "u1", email: "serwis.test@ontime.local" })) }));
vi.mock("@/lib/data/service-part-report", () => ({ reportServicePartShortage: vi.fn() }));
vi.mock("@/lib/data/service-parts", () => ({
  resolveServicePartsCecha: vi.fn(async () => ({ cechaId: 7, name: "Części serwisowe" })),
  fetchServicePartTwIds: vi.fn(async () => [501]),
}));
vi.mock("@/lib/data/zd-estimate-min-stock", () => ({
  fetchZdEstimateMinStockOne: vi.fn(async () => existing.current),
  upsertZdEstimateMinStock: upsert,
}));
vi.mock("@/lib/subiekt/api", () => ({
  getSubiektProduct: vi.fn(async () => ({ tw_Nazwa: "Szczotki do silnika", tw_Symbol: "SZCZ-1", tw_IdGrupa: 3, grt_Nazwa: "SERWIS" })),
}));

import { actionSetServicePartMinStock } from "./service-parts";

describe("actionSetServicePartMinStock — czyje minimum", () => {
  beforeEach(() => {
    upsert.mockClear();
    existing.current = null;
  });

  it("bez minimum: serwis ustawia, notatka „Serwis: …”", async () => {
    const r = await actionSetServicePartMinStock({ twId: 501, minStock: 4 });
    expect(r.ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ subiektTwId: 501, minStockSzt: 4, note: "Serwis: serwis.test" }));
  });

  it("minimum serwisu: serwis zmienia i kasuje", async () => {
    existing.current = { minStockSzt: 4, note: "Serwis: serwis.test" };
    expect((await actionSetServicePartMinStock({ twId: 501, minStock: 0 })).ok).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("minimum zakupów: serwis nie nadpisuje ani nie kasuje", async () => {
    existing.current = { minStockSzt: 2000, note: "" };
    const r = await actionSetServicePartMinStock({ twId: 501, minStock: 5 });
    expect(r).toEqual({ ok: false, message: "Minimum 2000 szt. ustawiły zakupy — zmienić je mogą zakupy w Kreatorze ZD." });
    expect((await actionSetServicePartMinStock({ twId: 501, minStock: 0 })).ok).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });
});
