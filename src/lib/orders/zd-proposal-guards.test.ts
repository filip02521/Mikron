import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/zd-proposal-guard-inputs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/zd-proposal-guard-inputs")>()),
  loadZdProposalGuardInputs: vi.fn(),
}));
vi.mock("@/lib/subiekt/api", () => ({ fetchSubiektProductSalesDocs: vi.fn() }));

import { loadZdProposalGuardInputs } from "@/lib/data/zd-proposal-guard-inputs";
import { fetchSubiektProductSalesDocs } from "@/lib/subiekt/api";
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";
import {
  applyZdProposalGuards,
  median,
  zdIsNewItem,
  zdLineGuardFlags,
  zdOrderValueJump,
  zdPeakDocShare,
  zdPeakWindow,
  type ZdGuardLineFacts,
} from "./zd-proposal-guards";

// Dane wymyślone (repo publiczne).
const facts = (over: Partial<ZdGuardLineFacts> = {}): ZdGuardLineFacts => ({
  pieces: 10,
  prosbaPieces: 0,
  zdUnits: 10,
  priceNet: 5,
  tempo: 1,
  tempo90: 1,
  available: 0,
  openZd: 0,
  minStock: null,
  windows: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2],
  recentZdUnits: [],
  ...over,
});
const base = { dniZapasu: 25, hasHorizon: true, peak: null };
const flags = (over: Partial<ZdGuardLineFacts>, input: Partial<Parameters<typeof zdLineGuardFlags>[1]> = {}) =>
  zdLineGuardFlags(facts(over), { ...base, ...input });

describe("sufit", () => {
  // tempo 1 × (25 + 30) = 55 sztuk.
  it("dokładnie na suficie — bez flagi; sztuka ponad — flaga", () => {
    expect(flags({ available: 20, openZd: 15, pieces: 20 })).not.toContain("ceiling");
    expect(flags({ available: 20, openZd: 15, pieces: 21 })).toContain("ceiling");
  });
  it("sztuki z próśb nie liczą się do sufitu", () => {
    expect(flags({ available: 20, openZd: 15, pieces: 30, prosbaPieces: 10 })).not.toContain("ceiling");
  });
  it("minimum z Kreatora podnosi sufit", () => {
    expect(flags({ tempo: 0, pieces: 8, minStock: 8 })).not.toContain("ceiling");
    expect(flags({ tempo: 0, pieces: 9, minStock: 8 })).toContain("ceiling");
  });
});

describe("pik", () => {
  // tempo 90 d 1 × 25 dni × 2 = 50 sztuk.
  const share = (maxDoc: number, total: number) => ({ maxDoc, total });
  it("oba warunki na granicy — bez flagi", () => {
    expect(flags({ pieces: 51 }, { peak: share(60, 100) })).not.toContain("peak");
    expect(flags({ pieces: 50 }, { peak: share(61, 100) })).not.toContain("peak");
  });
  it("dokument > 60% i ilość > 2× tempo 90 d × dni — flaga", () => {
    expect(flags({ pieces: 51 }, { peak: share(61, 100) })).toContain("peak");
  });
  it("bez sprzedaży w oknie albo bez profilu — bez flagi", () => {
    expect(flags({ pieces: 51 }, { peak: share(0, 0) })).not.toContain("peak");
    expect(flags({ pieces: 51, tempo90: null }, { peak: share(61, 100) })).not.toContain("peak");
  });
  it("błąd zapytania — brak danych, nie pik", () => {
    const f = flags({ pieces: 51 }, { peak: "error" });
    expect(f).not.toContain("peak");
    expect(f).toContain("missing_data");
  });
  it("udział: pozycje jednego dokumentu sumowane, zwrot odejmuje od sprzedaży", () => {
    expect(
      zdPeakDocShare([
        { dokId: 1, qty: 4 },
        { dokId: 1, qty: 3 },
        { dokId: 2, qty: 5 },
        { dokId: 3, qty: -2 },
      ])
    ).toEqual({ maxDoc: 7, total: 10 });
    expect(zdPeakDocShare([])).toEqual({ maxDoc: 0, total: 0 });
  });
  it("okno 30 dni kończy się na dataDo", () => {
    expect(zdPeakWindow("2026-03-01")).toEqual({ dataOd: "2026-01-31", dataDo: "2026-03-01" });
  });
});

describe("skok vs ostatnie ZD", () => {
  it("mniej niż 2 ZD — bez flagi", () => {
    expect(flags({ zdUnits: 100, recentZdUnits: [1] })).not.toContain("jump");
  });
  it("granica 3× średniej z 4 ostatnich (starsze pomijane)", () => {
    // średnia z [4, 2, 4, 2] = 3 → próg 9; piąte ZD (1000) poza historią.
    const recentZdUnits = [4, 2, 4, 2, 1000];
    expect(flags({ zdUnits: 9, recentZdUnits })).not.toContain("jump");
    expect(flags({ zdUnits: 10, recentZdUnits })).toContain("jump");
  });
});

describe("nowość", () => {
  const fresh = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 3];
  it("pierwsza sprzedaż w 3 ostatnich oknach i wartość > 500 zł", () => {
    expect(flags({ windows: fresh, pieces: 100, priceNet: 5 })).not.toContain("new_item"); // 500 zł
    expect(flags({ windows: fresh, pieces: 101, priceNet: 5 })).toContain("new_item");
  });
  it("sprzedaż starsza niż 3 okna albo brak sprzedaży — nie nowość", () => {
    expect(zdIsNewItem([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3])).toBe(false);
    expect(zdIsNewItem([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(false);
    expect(zdIsNewItem([0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0])).toBe(true);
    expect(zdIsNewItem(null)).toBe(false);
  });
});

describe("brak danych", () => {
  it("brak tempa, ceny albo czasu dostawy", () => {
    expect(flags({})).toEqual([]);
    expect(flags({ tempo: null })).toEqual(["missing_data"]);
    expect(flags({ priceNet: null })).toEqual(["missing_data"]);
    expect(flags({}, { hasHorizon: false })).toEqual(["missing_data"]);
  });
});

describe("wartość ZD", () => {
  it("mniej niż 3 ZD — bez flagi", () => {
    expect(zdOrderValueJump(1e9, [1, 1])).toBe(false);
  });
  it("granica 2× mediany 6 ostatnich (starsze pomijane)", () => {
    // mediana [100, 300, 200, 100, 300, 200] = 200 → próg 400.
    const hist = [100, 300, 200, 100, 300, 200, 99999];
    expect(zdOrderValueJump(400, hist)).toBe(false);
    expect(zdOrderValueJump(401, hist)).toBe(true);
    expect(median([3, 1, 2])).toBe(2);
  });
});

// --- przebieg na kontekście z silnika (I/O zamockowane) ---

function engineLine(tw: number, over: Record<string, unknown> = {}) {
  return {
    tw_Id: tw,
    tw_Symbol: `S${tw}`,
    tw_Nazwa: `Towar ${tw}`,
    dostepne: 0,
    otwarteZd: 0,
    sprzedazDziennie: 1,
    sprzedazOkres: 30,
    celZapasuTracked: 25,
    demandFloor: { sales90: 90, rateBefore: 0.5, rateAfter: 1 },
    ...over,
  };
}
function proposalLine(tw: number, pieces: number, over: Partial<ZdAutoProposalLine> = {}): ZdAutoProposalLine {
  return { twId: tw, symbol: `S${tw}`, nazwa: `Towar ${tw}`, zdUnits: pieces, pieces, unitLabel: "szt", priceNet: 2, prosbaPieces: 0, floor: true, ...over };
}
function ctxOf(lines: ZdAutoProposalLine[], pozycje: ReturnType<typeof engineLine>[]): ZdProposalHookContext {
  return {
    supplierId: "00000000-0000-4000-8000-000000000001",
    lines,
    list: { lines: pozycje.map((line) => ({ line })) },
    engine: {
      result: { pozycje, parametry: { dniOkresu: 30 } },
      packaging: [],
      bomRefs: [],
      minStockByTwId: new Map(),
    },
    horizon: { leadDays: 5 },
    prices: new Map(),
    dniZapasuUsed: 25,
    dataDo: "2026-03-01",
  } as unknown as ZdProposalHookContext;
}
const inputs = (over = {}) => ({
  recentZdUnitsByTw: new Map<number, number[]>(),
  recentOrderValues: [] as number[],
  profileWindowsByTw: new Map<number, number[]>(),
  ...over,
});

describe("applyZdProposalGuards", () => {
  beforeEach(() => vi.mocked(fetchSubiektProductSalesDocs).mockReset());
  const doc = (dokId: number, qty: number) => ({ rola: "fs" as const, dokId, dokNr: "", date: "", khId: null, khSymbol: "", khName: "", qty });

  it("Subiekt pytany tylko o linie ponad próg ilości piku; ilości bez zmian", async () => {
    vi.mocked(loadZdProposalGuardInputs).mockResolvedValue(inputs());
    vi.mocked(fetchSubiektProductSalesDocs).mockResolvedValue({ rows: [doc(7, 40), doc(8, 10)], truncated: false });
    const out = await applyZdProposalGuards(ctxOf([proposalLine(1, 10), proposalLine(2, 51)], [engineLine(1), engineLine(2)]));
    expect(fetchSubiektProductSalesDocs).toHaveBeenCalledTimes(1);
    expect(fetchSubiektProductSalesDocs).toHaveBeenCalledWith({ towarId: 2, dataOd: "2026-01-31", dataDo: "2026-03-01" });
    expect(out.lines[0]!.flags).toBeUndefined();
    expect(out.lines[1]!.flags).toEqual(["peak"]);
    expect(out.lines.map((l) => l.pieces)).toEqual([10, 51]);
  });

  it("niepełna lista dokumentów (błąd zapytania) — linia z brakiem danych, propozycja dalej", async () => {
    vi.mocked(loadZdProposalGuardInputs).mockResolvedValue(inputs());
    vi.mocked(fetchSubiektProductSalesDocs).mockResolvedValue({ rows: [doc(7, 40)], truncated: true });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = await applyZdProposalGuards(ctxOf([proposalLine(2, 51)], [engineLine(2)]));
    expect(out.lines[0]!.flags).toEqual(["missing_data"]);
  });

  it("wartość ZD > 2× mediany ostatnich ZD dostawcy — flaga propozycji", async () => {
    vi.mocked(loadZdProposalGuardInputs).mockResolvedValue(inputs({ recentOrderValues: [10, 10, 10] }));
    const out = await applyZdProposalGuards(ctxOf([proposalLine(1, 11)], [engineLine(1)]));
    expect(out.proposalFlags).toEqual(["order_value_jump"]);
  });

  it("linia spoza listy silnika i bez czasu dostawy — brak danych", async () => {
    vi.mocked(loadZdProposalGuardInputs).mockResolvedValue(inputs());
    const ctx = { ...ctxOf([proposalLine(1, 5), proposalLine(9, 5)], [engineLine(1)]), horizon: null };
    const out = await applyZdProposalGuards(ctx);
    expect(out.lines.map((l) => l.flags)).toEqual([["missing_data"], ["missing_data"]]);
  });

  it("błąd odczytu bazy nie blokuje propozycji: każda linia z brakiem danych", async () => {
    vi.mocked(loadZdProposalGuardInputs).mockImplementation(async () => {
      throw new Error("db down");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const out = await applyZdProposalGuards(ctxOf([proposalLine(1, 5)], [engineLine(1)]));
    expect(out).toEqual({ lines: [{ ...proposalLine(1, 5), flags: ["missing_data"] }], proposalFlags: [] });
  });
});
