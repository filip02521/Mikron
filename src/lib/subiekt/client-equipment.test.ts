import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let pages: Record<string, { dok_Id: number; dok_Uwagi?: string | null; dok_DataWyst?: string }[][]> = {};

vi.mock("@/lib/subiekt/client", () => ({
  subiektJson: vi.fn(async (path: string) => {
    calls.push(path);
    const base = path.split("?")[0]!;
    const page = Number(new URLSearchParams(path.split("?")[1]).get("page"));
    return { data: pages[base]?.[page - 1] ?? [] };
  }),
}));
vi.mock("@/lib/subiekt/api", () => ({
  getSubiektDocument: vi.fn(async (id: number) => ({
    dok_Id: id,
    dok_NrPelny: id === 2 ? "PA 1/M/11/2026" : `FS ${id}`,
    dok_DataWyst: "2026-11-01T00:00:00",
    dok_Uwagi: "1. AB123456",
    dok_Pozycja: [{ ob_Id: 1, ob_TowId: 500 + id, tw_Symbol: `M${id}`, tw_Nazwa: `Model ${id}` }],
  })),
  getSubiektProduct: vi.fn(async (id: number) => ({ tw_Id: id, tw_Rodzaj: 1 })),
}));

import { fetchClientEquipment } from "./client-equipment";

const full = (from: number) => Array.from({ length: 200 }, (_, i) => ({ dok_Id: from + i, dok_Uwagi: null }));

describe("fetchClientEquipment", () => {
  beforeEach(() => {
    calls.length = 0;
    pages = {};
  });

  it("FS filtruje po kh_id, PA po odbiorcaId (nazwy sprawdzone na żywym API)", async () => {
    pages["/documents/fs"] = [[{ dok_Id: 1, dok_Uwagi: "1. AB123456" }]];
    pages["/documents/pa"] = [[{ dok_Id: 2, dok_Uwagi: "3.S/N:CD987654" }]];
    const r = await fetchClientEquipment(42);
    const fs = calls.find((c) => c.startsWith("/documents/fs?"))!;
    const pa = calls.find((c) => c.startsWith("/documents/pa?"))!;
    expect(new URLSearchParams(fs.split("?")[1]).get("kh_id")).toBe("42");
    expect(new URLSearchParams(pa.split("?")[1]).get("odbiorcaId")).toBe("42");
    expect(r.items.map((i) => i.invoiceNumber).sort()).toEqual(["FS 1", "PA 1/M/11/2026"]);
    expect(r).toMatchObject({ invoicesScanned: 2, truncated: false });
  });

  it("strony do pierwszej krótszej niż 200 — nie ufa totalPages", async () => {
    pages["/documents/fs"] = [full(1000), full(2000), [{ dok_Id: 3, dok_Uwagi: null }]];
    const r = await fetchClientEquipment(7);
    expect(calls.filter((c) => c.startsWith("/documents/fs?")).length).toBe(3);
    expect(r.invoicesScanned).toBe(401);
  });
});
