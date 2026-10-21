import { describe, expect, it } from "vitest";
import { buildManualZdEstimateResult } from "@/lib/orders/zd-estimate-manual";
import type { ZdProductBomRef } from "@/lib/orders/zd-estimate-bom";
import type { ZdProductPairRef } from "@/lib/orders/zd-product-pair-units";
import type { SubiektZdEstimateLine } from "@/lib/subiekt/types";
import { analyzeStockWatchItem } from "@/lib/stock-watch/analysis";
import {
  resolveStockWatchBomViews,
  resolveStockWatchLineFigures,
} from "@/lib/stock-watch/bom-stock";

const DAYS = 30;

function sub(
  tw_Id: number,
  tw_Symbol: string,
  over: Partial<SubiektZdEstimateLine> = {}
): SubiektZdEstimateLine {
  // Subiekt podaje tempo dzienne obok sprzedaży w oknie.
  const sales = Number(over.sprzedazOkres ?? 0);
  return {
    tw_Id,
    tw_Symbol,
    tw_Nazwa: tw_Symbol,
    sprzedazOkres: 0,
    sprzedazDziennie: sales / DAYS,
    dostepne: 0,
    tw_Stan: over.dostepne ?? 0,
    celZapasu: 0,
    otwarteZd: 0,
    doZamowienia: 0,
    ...over,
  };
}

function assemble(parentTwId: number, components: [number, number][], stockAsCover = true): ZdProductBomRef {
  return {
    parentTwId,
    stockAsCover,
    demandAllocation: "explode",
    purchaseTarget: "components",
    components: components.map(([componentTwId, qtyPerParent]) => ({ componentTwId, qtyPerParent })),
  };
}

function separate(
  parentTwId: number,
  purchaseTarget: "as_sold" | "kit_only" | "kit_from_components",
  components: [number, number][]
): ZdProductBomRef {
  return {
    parentTwId,
    stockAsCover: false,
    demandAllocation: "separate",
    purchaseTarget,
    components: components.map(([componentTwId, qtyPerParent]) => ({ componentTwId, qtyPerParent })),
  };
}

/** Ta sama ścieżka co worker: Kreator → widok składów → liczby wiersza → status. */
function run(
  lines: SubiektZdEstimateLine[],
  boms: ZdProductBomRef[],
  opts: {
    pairs?: ZdProductPairRef[];
    packaging?: Map<number, { unitsPerPackage: number; documentUnitMode?: "packages" | "pieces" }>;
    missingBomTwIds?: number[];
  } = {}
) {
  const result = buildManualZdEstimateResult({ dniZapasu: DAYS, dniOkresu: DAYS, zapasMin: 0 }, lines, {
    salesTrack: false,
    salesTrackCuts: false,
    productBoms: boms,
    productPairs: opts.pairs ?? [],
    packagingByTwId: opts.packaging ?? null,
    missingBomTwIds: opts.missingBomTwIds ? new Set(opts.missingBomTwIds) : null,
  });
  const packaging = opts.packaging ?? new Map();
  const views = resolveStockWatchBomViews({
    byTw: new Map(result.pozycje.map((l) => [l.tw_Id, l])),
    boms,
    packagingByTwId: packaging,
    dniOkresu: DAYS,
    fallbackDniOkresu: DAYS,
  });
  const out = new Map<number, ReturnType<typeof row>>();
  function row(line: (typeof result.pozycje)[number]) {
    const figures = resolveStockWatchLineFigures(line, views.get(line.tw_Id) ?? null, packaging.get(line.tw_Id) ?? null);
    const signal = analyzeStockWatchItem({
      availableQty: figures.availableQty,
      openZdQty: figures.openZdQty,
      velocityDaily: figures.velocityDaily,
      targetQty: figures.targetQty,
      minStockQty: null,
      unitPriceNet: null,
      salesEndDate: "2026-10-20",
      assemblyQty: figures.assembly?.coversDemand ? figures.assembly.qty : 0,
      assemblyActionable: figures.assembly?.actionable === true,
    });
    return { ...figures, ...signal, line };
  }
  for (const line of result.pozycje) out.set(line.tw_Id, row(line));
  return out;
}

const KIT = 100;
const A = 1;
const B = 2;
const D = 3;

describe("Braki — zestaw „Składamy” (explode)", () => {
  it("zestaw na 0 z częściami na stanie = do kompletacji, nie brak", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30 }),
        sub(A, "A", { dostepne: 10 }),
        sub(B, "B", { dostepne: 40 }),
      ],
      [assemble(KIT, [[A, 1], [B, 2]])]
    );
    const kit = rows.get(KIT)!;
    expect(kit.bomRole).toBe("assembled_parent");
    expect(kit.availableQty).toBe(0);
    // Sprzedaż zestawu przeniesiona w Kreatorze na składniki — tu wraca na wiersz zestawu.
    expect(kit.salesPeriodQty).toBe(30);
    expect(kit.velocityDaily).toBe(1);
    expect(kit.assembly).toMatchObject({ kind: "assemble", qty: 10, actionable: true, coversDemand: true });
    expect(kit.assembly?.note).toContain("A ×1: 10 szt");
    expect(kit.assembly?.note).toContain("B ×2: 40 szt");
    expect(kit.status).toBe("to_assemble");
    expect(kit.daysOfCover).toBe(10);
    expect(kit.orderable).toBe(false);
  });

  it("ograniczenie najsłabszym składnikiem (zaokrąglenie w dół)", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30 }),
        sub(A, "A", { dostepne: 10 }),
        sub(B, "B", { dostepne: 7 }),
      ],
      [assemble(KIT, [[A, 1], [B, 2]])]
    );
    expect(rows.get(KIT)!.assembly?.qty).toBe(3);
    expect(rows.get(KIT)!.status).toBe("to_assemble");
  });

  it("zestaw i części na 0 = prawdziwy brak; składniki niosą popyt zestawu (jak Kreator)", () => {
    const rows = run(
      [sub(KIT, "KIT", { sprzedazOkres: 30 }), sub(A, "A"), sub(B, "B")],
      [assemble(KIT, [[A, 1], [B, 2]])]
    );
    expect(rows.get(KIT)!.status).toBe("out_of_stock");
    expect(rows.get(KIT)!.assembly).toBeNull();
    const b = rows.get(B)!;
    expect(b.velocityDaily).toBe(2);
    expect(b.status).toBe("out_of_stock");
    expect(b.line.doZamowieniaReczne).toBeGreaterThan(0);
  });

  it("części tylko w drodze: zestaw nie jest „pustą półką bez dostawy”", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30 }),
        sub(A, "A", { otwarteZd: 5 }),
        sub(B, "B", { dostepne: 40 }),
      ],
      [assemble(KIT, [[A, 1], [B, 2]])]
    );
    const kit = rows.get(KIT)!;
    expect(kit.status).toBe("out_of_stock");
    expect(kit.openZdQty).toBe(5);
  });

  it("zestaw z własnym stanem na długo — w normie, kompletacja tylko podpowiedzią", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30, dostepne: 20 }),
        sub(A, "A", { dostepne: 10 }),
        sub(B, "B", { dostepne: 40 }),
      ],
      [assemble(KIT, [[A, 1], [B, 2]])]
    );
    const kit = rows.get(KIT)!;
    expect(kit.status).toBe("ok");
    expect(kit.daysOfCover).toBe(30);
    expect(kit.assembly?.qty).toBe(10);
  });

  it("składnik: stan karty bez wkładu kompletów, ZD kompletów jako towar w drodze", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { dostepne: 4, otwarteZd: 6 }),
        sub(A, "A", { sprzedazOkres: 15 }),
      ],
      [assemble(KIT, [[A, 1]])]
    );
    const a = rows.get(A)!;
    // Kreator: dostępne = 0 + (4 + 6) × 1.
    expect(a.line.dostepne).toBe(10);
    expect(a.availableQty).toBe(0);
    expect(a.openZdQty).toBe(6);
    expect(a.assembly).toMatchObject({ kind: "disassemble", qty: 4, actionable: true });
    expect(a.status).toBe("to_assemble");
    expect(a.daysOfCover).toBe(8);
  });

  it("składnik sprzedawany tylko w zestawach — komplet na półce wystarcza, bez rozkładania", () => {
    const rows = run(
      [sub(KIT, "KIT", { dostepne: 40, sprzedazOkres: 15 }), sub(A, "A")],
      [assemble(KIT, [[A, 1]])]
    );
    const a = rows.get(A)!;
    expect(a.assembly?.actionable).toBe(false);
    expect(a.status).not.toBe("to_assemble");
    expect(a.status).not.toBe("out_of_stock");
  });

  it("„stan zestawu jako pokrycie” wyłączone — komplety nie pokrywają składnika", () => {
    const rows = run(
      [sub(KIT, "KIT", { dostepne: 40 }), sub(A, "A", { sprzedazOkres: 15 })],
      [assemble(KIT, [[A, 1]], false)]
    );
    const a = rows.get(A)!;
    expect(a.assembly).toBeNull();
    expect(a.status).toBe("out_of_stock");
  });

  it("brak składnika na liście — bez zgadywania kompletacji", () => {
    const rows = run(
      [sub(KIT, "KIT", { sprzedazOkres: 30 }), sub(A, "A", { dostepne: 10 })],
      [assemble(KIT, [[A, 1], [B, 1]])],
      { missingBomTwIds: [B] }
    );
    expect(rows.get(KIT)!.assembly).toBeNull();
    expect(rows.get(KIT)!.status).toBe("out_of_stock");
  });

  it("zestaw w zestawie: części wewnętrznego liczą się do zewnętrznego", () => {
    const OUTER = 200;
    const rows = run(
      [
        sub(OUTER, "OUTER", { sprzedazOkres: 30 }),
        sub(KIT, "KIT"),
        sub(A, "A", { dostepne: 3 }),
        sub(B, "B", { dostepne: 5 }),
        sub(D, "D", { dostepne: 4 }),
      ],
      [assemble(OUTER, [[KIT, 1], [D, 1]]), assemble(KIT, [[A, 1], [B, 1]])]
    );
    expect(rows.get(OUTER)!.assembly?.qty).toBe(3);
    expect(rows.get(OUTER)!.status).toBe("to_assemble");
  });

  it("rezerwacje ponad stan zjadają kompletację", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30, dostepne: -5 }),
        sub(A, "A", { dostepne: 4 }),
      ],
      [assemble(KIT, [[A, 1]])]
    );
    expect(rows.get(KIT)!.status).toBe("out_of_stock");
  });

  it("otwarte ZD składnika w opakowaniach przeliczone na sztuki karty", () => {
    const rows = run(
      [sub(KIT, "KIT", { sprzedazOkres: 30 }), sub(A, "A", { otwarteZd: 2 })],
      [assemble(KIT, [[A, 1]])],
      { packaging: new Map([[A, { unitsPerPackage: 12, documentUnitMode: "packages" as const }]]) }
    );
    expect(rows.get(A)!.openZdQty).toBe(24);
    expect(rows.get(KIT)!.openZdQty).toBe(24);
  });
});

describe("Braki — komplety kupowane (separate)", () => {
  it("Kupujemy komplet i części: zestaw zamawiany jak w Kreatorze, kompletacja tylko podpowiedź", () => {
    const rows = run(
      [
        sub(KIT, "KIT", { sprzedazOkres: 30 }),
        sub(A, "A", { dostepne: 10 }),
      ],
      [separate(KIT, "as_sold", [[A, 1]])]
    );
    const kit = rows.get(KIT)!;
    expect(kit.bomRole).toBe("purchased_kit");
    expect(kit.assembly).toMatchObject({ kind: "assemble", qty: 10, coversDemand: false });
    expect(kit.status).toBe("out_of_stock");
    expect(kit.orderable).toBe(true);
  });

  it("Komplet ze sprzedaży składników: kolor na 0, MIX na stanie = rozłóż komplet", () => {
    const MIX = 300;
    const rows = run(
      [
        sub(MIX, "MIX", { dostepne: 2 }),
        sub(A, "A-ZIELONY", { sprzedazOkres: 15 }),
        sub(B, "B-NIEBIESKI", { sprzedazOkres: 15, dostepne: 30 }),
      ],
      [separate(MIX, "kit_from_components", [[A, 6], [B, 6]])]
    );
    const a = rows.get(A)!;
    expect(a.assembly).toMatchObject({ kind: "disassemble", qty: 12, actionable: true });
    expect(a.status).toBe("to_assemble");
    expect(rows.get(B)!.status).not.toBe("to_assemble");
  });
});

describe("Braki — pary paczka↔sztuka", () => {
  it("paczka liczy stan w sztukach pary; sztuka bez sprzedaży (popyt na paczce)", () => {
    const KARTON = 10;
    const SZT = 11;
    const rows = run(
      [
        sub(KARTON, "KARTON", { sprzedazOkres: 1, dostepne: 2 }),
        sub(SZT, "SZT", { sprzedazOkres: 20, dostepne: 5 }),
      ],
      [],
      { pairs: [{ packTwId: KARTON, pieceTwId: SZT, unitsPerPack: 10 }] }
    );
    const karton = rows.get(KARTON)!;
    expect(karton.availableQty).toBe(25);
    expect(karton.salesPeriodQty).toBe(30);
    expect(karton.velocityDaily).toBe(1);
    expect(karton.status).not.toBe("out_of_stock");
    expect(rows.get(SZT)!.status).toBe("no_sales");
  });
});
