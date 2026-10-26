import { beforeEach, describe, expect, it, vi } from "vitest";

// Baza: ostatni dzień zapisanego profilu zakresu + rejestr zapisów.
const db = { latest: null as string | null, inserts: 0 };
vi.mock("@/lib/db/pool", () => ({
  query: vi.fn(async (sql: string) => {
    if (sql.includes("max(end_date)")) return { rows: [{ end_date: db.latest }] };
    if (sql.includes("INSERT INTO zd_sales_profiles")) db.inserts += 1;
    return { rows: [] };
  }),
}));

// Subiekt: każde okno czeka na `gate`, dopóki test go nie otworzy.
let gate: { open: () => void; fail: (e: Error) => void; promise: Promise<void> };
function newGate() {
  let open!: () => void;
  let fail!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    open = res;
    fail = rej;
  });
  gate = { open, fail, promise };
}
const fetchAll = vi.fn(async () => {
  await gate.promise;
  return { parametry: {}, pozycje: [{ tw_Id: 11, sprzedazOkres: 3 }], pagesFetched: 1, totalCountApi: 1, truncated: false };
});
vi.mock("@/lib/subiekt/api", () => ({ fetchSubiektZdEstimateAll: (...a: unknown[]) => fetchAll(...(a as [])) }));

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("prepareZdSalesProfile (Policz, krok 1)", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchAll.mockClear();
    db.latest = null;
    db.inserts = 0;
    newGate();
  });

  it("brak profilu: liczy w tle raz, pyta „computing”, po zakończeniu „ready”", async () => {
    const { prepareZdSalesProfile } = await import("./zd-sales-profile-load");
    const scope = { mode: "cecha" as const, id: 7 };
    await expect(prepareZdSalesProfile(scope, "2026-10-26")).resolves.toEqual({ status: "computing" });
    await expect(prepareZdSalesProfile(scope, "2026-10-26")).resolves.toEqual({ status: "computing" });
    const windowsFetched = fetchAll.mock.calls.length;
    expect(windowsFetched).toBeGreaterThan(0);
    gate.open();
    await flush();
    await flush();
    await expect(prepareZdSalesProfile(scope, "2026-10-26")).resolves.toEqual({ status: "ready" });
    // Drugie pytanie w trakcie liczenia nie wystartowało drugiego liczenia (12 okien raz).
    expect(fetchAll.mock.calls.length).toBe(12);
    expect(db.inserts).toBe(1);
  });

  it("profil do 14 dni: od razu „ready”, bez liczenia", async () => {
    db.latest = "2026-10-20";
    const { prepareZdSalesProfile } = await import("./zd-sales-profile-load");
    await expect(prepareZdSalesProfile({ mode: "cecha", id: 7 }, "2026-10-26")).resolves.toEqual({ status: "ready" });
    expect(fetchAll).not.toHaveBeenCalled();
  });

  it("błąd liczenia: raz „failed” z komunikatem, potem nowa próba", async () => {
    const { prepareZdSalesProfile } = await import("./zd-sales-profile-load");
    const scope = { mode: "grupa" as const, id: 3 };
    await prepareZdSalesProfile(scope, "2026-10-26");
    // Okno ponawia raz — oba podejścia padają.
    gate.fail(new Error("Subiekt timeout"));
    await flush();
    await flush();
    const failed = await prepareZdSalesProfile(scope, "2026-10-26");
    expect(failed).toEqual({ status: "failed", message: "Subiekt timeout" });
    newGate();
    await expect(prepareZdSalesProfile(scope, "2026-10-26")).resolves.toEqual({ status: "computing" });
  });

  it("starsza data „do” (profil nie trafia do bazy): krok 2 bierze wynik z kroku 1, nie liczy drugi raz", async () => {
    db.latest = "2026-10-25";
    const { prepareZdSalesProfile, ensureZdSalesProfiles } = await import("./zd-sales-profile-load");
    const scope = { mode: "cecha" as const, id: 7 };
    await prepareZdSalesProfile(scope, "2026-09-01");
    gate.open();
    await flush();
    await flush();
    expect(db.inserts).toBe(0);
    await expect(prepareZdSalesProfile(scope, "2026-09-01")).resolves.toEqual({ status: "ready" });
    const calls = fetchAll.mock.calls.length;
    const profiles = await ensureZdSalesProfiles({ scopes: [scope], endDate: "2026-09-01", refresh: "background" });
    expect(profiles.get(11)?.length).toBe(12);
    expect(fetchAll.mock.calls.length).toBe(calls);
  });
});
