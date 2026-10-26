import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ZdBacktestRun } from "@/lib/data/zd-backtest-run";
import type { ZdSupplierOrderPolicyRow } from "@/lib/data/zd-supplier-order-policy";

const SUP = "00000000-0000-4000-8000-000000000001";
const RUN = "00000000-0000-4000-8000-0000000000aa";
let latest: ZdBacktestRun | null = null;
let current: ZdSupplierOrderPolicyRow;
const upserts: Array<Record<string, unknown>> = [];

vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => ({ id: "u1" })),
  requireZdEstimateAdmin: vi.fn(async () => ({ id: "u1" })),
}));
vi.mock("@/lib/data/zd-backtest-run", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-backtest-run")>()),
  fetchLatestZdBacktestRun: vi.fn(async () => latest),
}));
vi.mock("@/lib/data/zd-supplier-order-policy", async (orig) => ({
  ...(await orig<typeof import("@/lib/data/zd-supplier-order-policy")>()),
  fetchZdSupplierOrderPolicy: vi.fn(async () => current),
  upsertZdSupplierOrderPolicy: vi.fn(async (i: Record<string, unknown>) => {
    upserts.push(i);
    return { policy: { ...current, ...i }, warning: null };
  }),
}));

import { actionApplyZdBacktestSettings } from "./zd-backtest";
import { actionSaveZdSupplierOrderPolicy } from "./zd-estimate";

const classic: ZdSupplierOrderPolicyRow = {
  supplierId: SUP,
  strategy: "classic",
  targetDays: null,
  cycleDays: null,
  autoProposals: false,
  autoLevel: 0,
  cutoffTime: "14:00",
  updatedAt: null,
};
const run = (over: { version?: 1 | 2 | 3; kind?: "works" | "fails" | "insufficient"; daysAgo?: number; id?: string } = {}): ZdBacktestRun => {
  const at = new Date(Date.now() - (over.daysAgo ?? 1) * 86_400_000).toISOString();
  return {
    id: over.id ?? RUN,
    supplierId: SUP,
    status: "done",
    params: { cycleDays: 2, targetDays: 21 },
    progress: {},
    error: null,
    createdAt: at,
    finishedAt: at,
    result: {
      version: over.version ?? 3,
      params: { cycleDays: 2, targetDays: 21 },
      verdict: { kind: over.kind ?? "works", headline: "", reasons: [] },
    } as unknown as ZdBacktestRun["result"],
  };
};

describe("automat włącza się tylko z backtestu", () => {
  beforeEach(() => {
    upserts.length = 0;
    current = classic;
    latest = run();
  });

  it("świeży wynik: zapisuje znalezione ustawienia, stopień co najmniej 1, godzina odcięcia bez zmian", async () => {
    const r = await actionApplyZdBacktestSettings({ supplierId: SUP, runId: RUN });
    expect(r.ok).toBe(true);
    expect(upserts).toEqual([
      expect.objectContaining({ strategy: "max30_90", cycleDays: 2, targetDays: 21, autoLevel: 1, autoProposals: true, cutoffTime: "14:00" }),
    ]);
    expect(r.ok && r.message).toBe("Automat włączony: ZD co 2 dni, cel 21 dni. Pierwsza propozycja powstanie w nocnym przebiegu.");
  });

  it("wyższy stopień zostaje przy przestawieniu", async () => {
    current = { ...classic, strategy: "max30_90", cycleDays: 7, targetDays: 25, autoLevel: 2, autoProposals: true, cutoffTime: "12:30" };
    const r = await actionApplyZdBacktestSettings({ supplierId: SUP, runId: RUN });
    expect(r.ok && r.message).toMatch(/^Automat przestawiony/);
    expect(upserts[0]).toMatchObject({ autoLevel: 2, cutoffTime: "12:30", cycleDays: 2, targetDays: 21 });
  });

  it("nowszy przebieg od otwarcia okna — nic nie zapisuje", async () => {
    latest = run({ id: "00000000-0000-4000-8000-0000000000bb" });
    const r = await actionApplyZdBacktestSettings({ supplierId: SUP, runId: RUN });
    expect(r.ok).toBe(false);
    expect(upserts).toEqual([]);
  });

  it("bez backtestu, starsza wersja, za mało danych, gorzej niż dziś, stary — odmowa bez zapisu", async () => {
    for (const l of [null, run({ version: 2 }), run({ kind: "insufficient" }), run({ kind: "fails" }), run({ daysAgo: 91 })]) {
      latest = l;
      const r = await actionApplyZdBacktestSettings({ supplierId: SUP, runId: RUN });
      expect(r.ok).toBe(false);
    }
    expect(upserts).toEqual([]);
  });

  it("zwykły zapis strategii nie włącza automatu i nie zmienia cyklu ani celu", async () => {
    const off = await actionSaveZdSupplierOrderPolicy({ supplierId: SUP, strategy: "max30_90", targetDays: 5, cycleDays: 1, autoLevel: 1, cutoffTime: "14:00" });
    expect(off).toMatchObject({ ok: false, message: expect.stringMatching(/^Automat włączasz z backtestu/) });
    expect(upserts).toEqual([]);

    current = { ...classic, strategy: "max30_90", cycleDays: 2, targetDays: 21, autoLevel: 1, autoProposals: true };
    const on = await actionSaveZdSupplierOrderPolicy({ supplierId: SUP, strategy: "max30_90", targetDays: 5, cycleDays: 1, autoLevel: 2, cutoffTime: "13:00" });
    expect(on.ok).toBe(true);
    expect(upserts[0]).toMatchObject({ cycleDays: 2, targetDays: 21, autoLevel: 2, cutoffTime: "13:00" });
  });
});
