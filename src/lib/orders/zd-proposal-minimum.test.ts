import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/pool", () => ({ query: vi.fn() }));

import type { ZdAutoProposal, ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdAbc } from "@/lib/orders/zd-automat-contract";
import type { PackagingLookup } from "@/lib/orders/zd-estimate-packaging";
import type { ZdOrderListLine } from "@/lib/orders/zd-order-list";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";
import { decideZdProposalMinimum, type ZdProposalMinimumDeps } from "@/lib/orders/zd-proposal-minimum";
import { zdProposalMinimumNotice } from "@/lib/orders/zd-proposal-minimum-notice";

// Dane wymyślone (repo publiczne).
type RowOpts = { dostepne: number; v: number; cel?: number; otwarteZd?: number; zdUnits?: number; pieces?: number };

function row(tw: number, o: RowOpts): ZdOrderListLine {
  return {
    line: {
      tw_Id: tw,
      tw_Symbol: `S-${tw}`,
      tw_Nazwa: `Towar ${tw}`,
      dostepne: o.dostepne,
      sprzedazDziennie: o.v,
      celZapasu: o.cel ?? 0,
      celZapasuTracked: o.cel ?? 0,
      salesTrackDelta: 0,
      otwarteZd: o.otwarteZd ?? 0,
    } as ZdOrderListLine["line"],
    zdUnits: o.zdUnits ?? 0,
    piecesArriving: o.pieces ?? 0,
    piecesNeeded: o.pieces ?? 0,
    individualExtraPieces: 0,
    unitsPerPackage: null,
    packageLabel: null,
    packagesMode: false,
  };
}

const pl = (tw: number, pieces: number): ZdAutoProposalLine => ({
  twId: tw,
  symbol: `S-${tw}`,
  nazwa: `Towar ${tw}`,
  zdUnits: pieces,
  pieces,
  unitLabel: "szt",
  priceNet: null,
  prosbaPieces: 0,
  floor: false,
});

function ctx(input: {
  lines: ZdAutoProposalLine[];
  rows: ZdOrderListLine[];
  lastZd?: Record<number, number>;
  packaging?: Record<number, PackagingLookup>;
  leadDays?: number | null;
  excluded?: number[];
  extraOnly?: number[];
}): ZdProposalHookContext {
  return {
    supplierId: "00000000-0000-4000-8000-000000000001",
    lines: input.lines,
    list: {
      lines: input.rows,
      explodeBomIncomplete: false,
      orderExcludedTwIds: new Set(input.excluded ?? []),
      extraOnlyTwIds: new Set(input.extraOnly ?? []),
      serviceOrderIds: [],
    },
    engine: { packagingLookup: new Map(Object.entries(input.packaging ?? {}).map(([k, v]) => [Number(k), v])) },
    horizon: input.leadDays === null ? null : { leadDays: input.leadDays ?? 7 },
    prices: new Map(
      Object.entries(input.lastZd ?? {}).map(([k, v]) => [
        Number(k),
        { subiektTwId: Number(k), priceNet: v, dokId: 1, dokNr: null, dokDate: null },
      ])
    ),
    dniZapasuUsed: 25,
    dataDo: "2026-10-22",
  } as unknown as ZdProposalHookContext;
}

function deps(input: {
  min?: number | null;
  currency?: string | null;
  free?: number | null;
  catalog?: Record<number, number>;
  abc?: Record<number, ZdAbc>;
  catalogThrows?: boolean;
}) {
  const readCatalogPrices = vi.fn(async (ids: number[]) => {
    if (input.catalogThrows) throw new Error("Subiekt offline");
    return new Map(ids.filter((id) => input.catalog?.[id] != null).map((id) => [id, input.catalog![id]!]));
  });
  const d: ZdProposalMinimumDeps = {
    terms: { minOrderValue: input.min ?? null, minOrderCurrency: input.currency ?? null, freeShippingThreshold: input.free ?? null },
    cycleDays: 7,
    readCatalogPrices,
    readAbc: async (ids) => new Map(ids.filter((id) => input.abc?.[id]).map((id) => [id, input.abc![id]!])),
  };
  return { d, readCatalogPrices };
}

// Linia 1: 10 szt, pokrycie 100 dni (nie pilna).
const calm = row(1, { dostepne: 100, v: 1, cel: 25, zdUnits: 10, pieces: 10 });

describe("decideZdProposalMinimum — minimum", () => {
  it("bez minimum i progu: ok, ale priceNet też = kartotekowa (fallback ostatnie ZD)", async () => {
    const { d, readCatalogPrices } = deps({ catalog: { 1: 50 } });
    const other = row(2, { dostepne: 100, v: 1, zdUnits: 1, pieces: 1 });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10), pl(2, 1)], rows: [calm, other], lastZd: { 1: 40, 2: 7 } }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.lines.map((l) => l.priceNet)).toEqual([50, 7]);
    expect(readCatalogPrices).toHaveBeenCalledWith([1, 2]);
  });

  it("prośba handlowca jest pilna niezależnie od tempa — propozycja z samą prośbą nie jest odkładana", async () => {
    const prosba = row(2, { dostepne: 0, v: 0, zdUnits: 2, pieces: 2 });
    const { d } = deps({ min: 500, catalog: { 2: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [{ ...pl(2, 2), prosbaPieces: 2 }], rows: [prosba] }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    const free = await decideZdProposalMinimum(ctx({ lines: [{ ...pl(2, 2), prosbaPieces: 2 }], rows: [prosba] }), deps({ free: 1000, catalog: { 2: 10 } }).d);
    expect(free.outcome).toEqual({ kind: "ok" });
  });

  it("dopełnienie sortuje po pozycji z otwartymi ZD — towar z dużym ZD w drodze nie wchodzi pierwszy", async () => {
    const base = row(1, { dostepne: 100, v: 1, cel: 25, zdUnits: 85, pieces: 85 });
    const inTransit = row(2, { dostepne: 1, v: 1, cel: 30, otwarteZd: 20 }); // 21 dni
    const low = row(3, { dostepne: 4, v: 1, cel: 30 }); // 4 dni
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 10, 3: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, inTransit, low] }), d);
    if (r.outcome.kind !== "topped_up") throw new Error(r.outcome.kind);
    expect(r.outcome.addedTwIds).toEqual([3]);
  });

  it("dokładnie minimum → idzie (cena kartotekowa ma pierwszeństwo przed ostatnim ZD)", async () => {
    const { d } = deps({ min: 500, catalog: { 1: 50 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10)], rows: [calm], lastZd: { 1: 40 } }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.lines[0]!.priceNet).toBe(50);
  });

  it("grosz poniżej minimum, bez pilnych → odłożona z czytelnym powodem", async () => {
    const { d } = deps({ min: 500, catalog: { 1: 49.999 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10)], rows: [calm] }), d);
    expect(r.outcome).toEqual({ kind: "deferred", reason: "Minimum 500 zł, propozycja 499,99 zł - przesunięta na kolejny cykl." });
  });

  it("poniżej minimum z pilną linią (pokrycie < cykl + dostawa) → idzie, powód w notes", async () => {
    const urgent = row(2, { dostepne: 6, v: 1, cel: 25, zdUnits: 5, pieces: 5 }); // 6 dni < 7 + 7
    const { d } = deps({ min: 500, catalog: { 1: 10, 2: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10), pl(2, 5)], rows: [calm, urgent] }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.notes.join(" ")).toContain("Poniżej minimum 500 zł (150 zł) - idzie, bo 1 pozycja pilna (prośba albo koniec stanu przed kolejną dostawą)");
  });

  // Cykl 7 + dostawa 7 = 14 dni: odłożenie o cykl nie może zostawić towaru bez stanu przed kolejną dostawą.
  it.each([
    [13, "ok"],
    [14, "deferred"],
    [15, "deferred"],
  ] as const)("granica pilności R + L: pokrycie %i dni → %s", async (days, kind) => {
    const edge = row(2, { dostepne: days * 2, v: 2, cel: 25, zdUnits: 5, pieces: 5 });
    const { d } = deps({ min: 500, catalog: { 2: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(2, 5)], rows: [edge] }), d);
    expect(r.outcome.kind).toBe(kind);
  });

  it("pokrycie liczy otwarte ZD w sztukach (opakowania × szt.)", async () => {
    // 5 szt + 2 op. × 5 szt = 15 dni ≥ 14 → odłożona; bez przeliczenia opakowań byłoby 7 dni (pilna).
    const inTransit = row(2, { dostepne: 5, v: 1, cel: 25, otwarteZd: 2, zdUnits: 1, pieces: 5 });
    const { d } = deps({ min: 500, catalog: { 2: 50 } });
    const r = await decideZdProposalMinimum(
      ctx({ lines: [pl(2, 5)], rows: [inTransit], packaging: { 2: { unitsPerPackage: 5, documentUnitMode: "packages" } } }),
      d
    );
    expect(r.outcome.kind).toBe("deferred");
  });

  it("brak horyzontu → dostawa 7 dni; krótsza dostawa zawęża pilność", async () => {
    const thirteen = row(2, { dostepne: 13, v: 1, cel: 25, zdUnits: 5, pieces: 5 });
    const { d } = deps({ min: 500, catalog: { 2: 10 } });
    expect((await decideZdProposalMinimum(ctx({ lines: [pl(2, 5)], rows: [thirteen], leadDays: null }), d)).outcome.kind).toBe("ok");
    expect((await decideZdProposalMinimum(ctx({ lines: [pl(2, 5)], rows: [thirteen], leadDays: 3 }), d)).outcome.kind).toBe("deferred");
  });

  it("minimum w innej walucie → reguła pominięta, powód w notes", async () => {
    const { d } = deps({ min: 500, currency: "EUR", catalog: { 1: 1 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10)], rows: [calm] }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.notes[0]).toContain("Minimum dostawcy w EUR");
  });

  it("waluta PLN zapisana jawnie działa jak pusta", async () => {
    const { d } = deps({ min: 500, currency: "PLN", catalog: { 1: 1 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10)], rows: [calm] }), d);
    expect(r.outcome.kind).toBe("deferred");
  });

  it("linia bez żadnej ceny → nie odkłada (wartość nieznana), liczy „bez ceny”", async () => {
    const { d } = deps({ min: 500, catalog: { 1: 1 } });
    const other = row(3, { dostepne: 100, v: 1, zdUnits: 1, pieces: 1 });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 10), pl(3, 1)], rows: [calm, other] }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.lines[1]!.priceNet).toBeNull();
    expect(r.notes[0]).toMatch(/^1 pozycja bez ceny/);
  });

  it("błąd odczytu cen kartotekowych → cena z ostatniego ZD (za sztukę), reguła działa dalej", async () => {
    const { d } = deps({ min: 500, catalogThrows: true });
    const c = ctx({
      lines: [{ ...pl(1, 10), zdUnits: 2, unitLabel: "op." }],
      rows: [calm],
      lastZd: { 1: 100 }, // za opakowanie 5 szt → 20 zł/szt → 200 zł
      packaging: { 1: { unitsPerPackage: 5, documentUnitMode: "packages" } },
    });
    const r = await decideZdProposalMinimum(c, d);
    expect(r.lines[0]!.priceNet).toBe(20);
    expect(r.outcome).toEqual({ kind: "deferred", reason: "Minimum 500 zł, propozycja 200 zł - przesunięta na kolejny cykl." });
    expect(r.notes[0]).toContain("Ceny kartotekowe z Subiekta niedostępne");
  });
});

describe("decideZdProposalMinimum — darmowa dostawa", () => {
  // Propozycja: 85 szt × 10 zł = 850 zł; próg 1000 → brakuje 150 = dokładnie 15%.
  const base = row(1, { dostepne: 100, v: 1, cel: 25, zdUnits: 85, pieces: 85 });
  const soon = row(2, { dostepne: 2, v: 1, cel: 10 }); // 2 dni pokrycia
  const later = row(3, { dostepne: 5, v: 1, cel: 10 }); // 5 dni pokrycia

  it("brakuje dokładnie 15% → dopełnienie towarem z najmniejszym pokryciem, zaokrąglone do opakowania", async () => {
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 100, 3: 1 } }); // tw 2: 100 zł / op. 5 szt = 20 zł/szt
    const r = await decideZdProposalMinimum(
      ctx({
        lines: [pl(1, 85)],
        rows: [base, later, soon],
        packaging: { 2: { unitsPerPackage: 5, packageLabel: "op.", documentUnitMode: "packages" } },
      }),
      d
    );
    expect(r.outcome.kind).toBe("topped_up");
    if (r.outcome.kind !== "topped_up") return;
    expect(r.outcome.addedTwIds).toEqual([2]);
    // 150 zł / 20 zł = 8 szt → 2 op. = 10 szt (cap: cel 10 + 7 − 2 = 15 szt).
    const added = r.lines.find((l) => l.twId === 2)!;
    expect(added).toMatchObject({ zdUnits: 2, pieces: 10, unitLabel: "op.", priceNet: 20, topUpUnits: 2, prosbaPieces: 0 });
    expect(added.flags).toBeUndefined();
    expect(r.outcome.reason).toBe("Dopełniona do darmowej dostawy od 1000 zł: 1 pozycja za 200 zł (było 850 zł).");
  });

  it("brakuje grosz ponad 15% → bez dopełnienia; bez pilnych → odłożona", async () => {
    const { d } = deps({ free: 1000, catalog: { 1: 9.9999, 2: 20 } }); // 849,99 zł
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, soon] }), d);
    expect(r.outcome).toEqual({
      kind: "deferred",
      reason: "Darmowa dostawa od 1000 zł, propozycja 849,99 zł - przesunięta na kolejny cykl.",
    });
    expect(r.notes[0]).toContain("ponad 15%, bez dopełnienia");
  });

  it("ponad 15% z pilną linią → idzie bez dopełnienia", async () => {
    const urgentBase = row(1, { dostepne: 1, v: 1, cel: 25, zdUnits: 50, pieces: 50 });
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 20 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 50)], rows: [urgentBase, soon] }), d);
    expect(r.outcome).toEqual({ kind: "ok" });
    expect(r.lines).toHaveLength(1);
  });

  it("każdy towar najwyżej do celu + tempo × cykl — brakującą resztę bierze kolejny", async () => {
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 10, 3: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, later, soon] }), d);
    if (r.outcome.kind !== "topped_up") throw new Error(r.outcome.kind);
    // tw 2: cap 15 szt (150 zł) wystarcza na całą lukę; tw 3 nietknięty.
    expect(r.outcome.addedTwIds).toEqual([2]);
    expect(r.lines.find((l) => l.twId === 2)!.pieces).toBe(15);
    const small = row(2, { dostepne: 2, v: 1, cel: 0 }); // cap 7 − 2 = 5 szt = 50 zł
    const r2 = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, later, small] }), d);
    if (r2.outcome.kind !== "topped_up") throw new Error(r2.outcome.kind);
    expect(r2.outcome.addedTwIds).toEqual([2, 3]);
    expect(r2.lines.find((l) => l.twId === 2)!.pieces).toBe(5);
    expect(r2.lines.find((l) => l.twId === 3)!.pieces).toBe(10); // 100 zł brakującej reszty
  });

  it("linia z propozycji może urosnąć — topUpUnits to tylko dołożona część", async () => {
    const own = row(1, { dostepne: 0, v: 10, cel: 100, zdUnits: 85, pieces: 85 }); // cap 100 + 70 − 0 = 170
    const { d } = deps({ free: 1000, catalog: { 1: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [own] }), d);
    expect(r.outcome.kind).toBe("topped_up");
    expect(r.lines[0]).toMatchObject({ zdUnits: 100, pieces: 100, topUpUnits: 15 });
  });

  it("pomija wykluczone, „tylko na prośbę”, bez tempa i bez ceny", async () => {
    const zero = row(4, { dostepne: 0, v: 0, cel: 10 });
    const noPrice = row(5, { dostepne: 0, v: 1, cel: 30 });
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 20, 3: 20, 4: 20 } });
    const r = await decideZdProposalMinimum(
      ctx({ lines: [pl(1, 85)], rows: [base, soon, later, zero, noPrice], excluded: [2], extraOnly: [3] }),
      d
    );
    expect(r.outcome.kind).toBe("deferred");
    expect(r.notes.join(" ")).toContain("za mało towarów do dopełnienia");
    expect(r.lines).toHaveLength(1);
  });

  it("klasy ABC: z wierszami tylko A/B (bez klasy odpada); pusta tabela = bez filtra", async () => {
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 20, 3: 20 }, abc: { 2: "C", 3: "B" } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, soon, later] }), d);
    if (r.outcome.kind !== "topped_up") throw new Error(r.outcome.kind);
    expect(r.outcome.addedTwIds).toEqual([3]);
  });

  it("dopełnienie, które nie dochodzi do progu, nic nie dodaje", async () => {
    const tiny = row(2, { dostepne: 2, v: 1, cel: 0 }); // 5 szt × 10 zł = 50 zł < 150 zł
    const { d } = deps({ free: 1000, catalog: { 1: 10, 2: 10 } });
    const r = await decideZdProposalMinimum(ctx({ lines: [pl(1, 85)], rows: [base, tiny] }), d);
    expect(r.outcome.kind).toBe("deferred");
    expect(r.lines.map((l) => l.twId)).toEqual([1]);
  });
});

describe("zdProposalMinimumNotice", () => {
  const terms = { minOrderValue: 500, minOrderCurrency: null, freeShippingThreshold: 1000 };
  const p = (over: Partial<ZdAutoProposal>) =>
    ({ status: "pending", deferredReason: null, lines: [], valueNet: 0, supplierTerms: terms, ...over }) as ZdAutoProposal;

  it("odłożona: tylko powód i bez ceny", () => {
    const lines = [{ ...pl(1, 1), priceNet: null }];
    expect(zdProposalMinimumNotice(p({ status: "deferred", deferredReason: "Minimum 500 zł, propozycja 312 zł - przesunięta na kolejny cykl.", lines, valueNet: 312 }))).toEqual([
      { tone: "warning", text: "Minimum 500 zł, propozycja 312 zł - przesunięta na kolejny cykl." },
      { tone: "muted", text: "1 pozycja bez ceny - wartość niepełna." },
    ]);
  });

  it("dopełniona: wartość tylko dołożonej części", () => {
    const lines = [{ ...pl(2, 10), zdUnits: 2, priceNet: 20, topUpUnits: 1 }];
    expect(zdProposalMinimumNotice(p({ lines, valueNet: 1010 }))).toEqual([
      { tone: "info", text: "Dopełniona do darmowej dostawy od 1000 zł: 1 pozycja za 100 zł." },
    ]);
  });

  it("poniżej minimum i progu po poprawkach w panelu (wartość z panelu)", () => {
    const items = zdProposalMinimumNotice(p({ valueNet: 900 }), 400);
    expect(items.map((i) => i.text)).toEqual([
      "Poniżej minimum dostawcy 500 zł: propozycja 400 zł.",
      "Do darmowej dostawy od 1000 zł brakuje 600 zł.",
    ]);
  });

  it("minimum w innej walucie", () => {
    const items = zdProposalMinimumNotice(p({ supplierTerms: { minOrderValue: 200, minOrderCurrency: "EUR", freeShippingThreshold: null } }));
    expect(items).toEqual([{ tone: "muted", text: "Minimum dostawcy 200 EUR - nie porównuję z wartością w zł." }]);
  });
});
