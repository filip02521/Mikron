import { describe, expect, it } from "vitest";
import { buildManualZdEstimateResult } from "@/lib/orders/zd-estimate-manual";
import {
  applyZdBomDemandFloor,
  applyZdDemandFloorToLine,
  applyZdPairDemandFloor,
  effectiveDniZapasu,
  sales90FromProfile,
  ZD_SUPPLIER_ORDER_POLICY_CLASSIC,
  type ZdSupplierOrderPolicy,
} from "./zd-demand-policy";
import { zdProsbaFloorWindowRanges, zdProsbaPiecesByFloorWindow } from "./zd-sales-profile";

const test: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 21, cycleDays: 3 };

describe("zd-demand-policy", () => {
  it("dni zapasu: strategia nadpisuje dostawcę, classic zostawia", () => {
    expect(effectiveDniZapasu(test, 30)).toBe(21);
    expect(effectiveDniZapasu(ZD_SUPPLIER_ORDER_POLICY_CLASSIC, 30)).toBe(30);
  });

  it("90 d z ostatnich trzech okien profilu", () => {
    expect(sales90FromProfile([9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 20, 30])).toBe(60);
    expect(sales90FromProfile(null)).toBeNull();
  });

  it("podłoga 90 d: prośby odjęte z każdego z trzech okien, okno nie mniej niż 0", () => {
    expect(sales90FromProfile([9, 9, 9, 9, 9, 9, 9, 9, 9, 10, 20, 30], [5, 25, 10])).toBe(25);
  });

  it("prośba dostarczona 45 dni temu nie podnosi tempa z podłogi 90 d", () => {
    // 6 szt / 30 d z zapasu w każdym oknie + 60 szt pod prośbę sprzedane w środkowym oknie.
    const end = "2026-10-23";
    const windows = [9, 9, 9, 9, 9, 9, 9, 9, 9, 6, 66, 6];
    const prosba = zdProsbaPiecesByFloorWindow([["2026-09-08", 60]], end);
    expect(prosba).toEqual([0, 60, 0]);
    const line = { sprzedazOkres: 6, sprzedazDziennie: 0.2, celZapasu: 0.2 * 21 };
    const floor = (sales90: number | null) =>
      applyZdDemandFloorToLine(line, { policy: test, sales90, dniOkresu: 30, dniZapasu: 21 });
    expect(floor(sales90FromProfile(windows, prosba))).toBe(line);
    // Dotąd (prośba odjęta tylko z ostatniego okna) podłoga podnosiła tempo do 78/90 d.
    expect(floor(sales90FromProfile(windows)).sprzedazDziennie).toBeCloseTo(78 / 90, 6);
  });

  it("okna dostaw próśb: 14 d przed najstarszym, do 3 d przed końcem okna, bez nakładania", () => {
    expect(zdProsbaFloorWindowRanges("2026-10-23")).toEqual([
      { from: "2026-07-12", to: "2026-08-21" },
      { from: "2026-08-22", to: "2026-09-20" },
      { from: "2026-09-21", to: "2026-10-20" },
    ]);
    expect(
      zdProsbaPiecesByFloorWindow(
        [
          ["2026-07-11", 100], // przed zakresem
          ["2026-07-12", 1],
          ["2026-08-21", 2],
          ["2026-08-22", 4],
          ["2026-10-20", 8],
          ["2026-10-21", 100], // sprzeda się już po oknie
        ],
        "2026-10-23"
      )
    ).toEqual([3, 4, 8]);
  });

  it("słabszy miesiąc: tempo i cel podniesione do średniej 90 d", () => {
    // okno 30 d: 6 szt (0,2/d), 90 d: 36 szt (0,4/d); cel z API 6/30×21 + 2 = 6,2
    const out = applyZdDemandFloorToLine(
      { sprzedazOkres: 6, sprzedazDziennie: 0.2, celZapasu: 6.2 },
      { policy: test, sales90: 36, dniOkresu: 30, dniZapasu: 21 }
    );
    expect(out.sprzedazOkres).toBeCloseTo(12);
    expect(out.celZapasu).toBeCloseTo(6.2 + 0.2 * 21);
  });

  it("brak sprzedaży w oknie, ale była w 90 d — cel z tempa 90 d", () => {
    const out = applyZdDemandFloorToLine(
      { sprzedazOkres: 0, sprzedazDziennie: 0, celZapasu: 0 },
      { policy: test, sales90: 9, dniOkresu: 30, dniZapasu: 21 }
    );
    expect(out.celZapasu).toBeCloseTo(0.1 * 21);
  });

  it("nigdy nie obniża; classic i brak profilu bez zmian", () => {
    const line = { sprzedazOkres: 30, sprzedazDziennie: 1, celZapasu: 21 };
    expect(applyZdDemandFloorToLine(line, { policy: test, sales90: 30, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
    expect(applyZdDemandFloorToLine(line, { policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, sales90: 900, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
    expect(applyZdDemandFloorToLine(line, { policy: test, sales90: null, dniOkresu: 30, dniZapasu: 21 })).toBe(line);
  });
});

describe("applyZdPairDemandFloor — para jako jeden popyt", () => {
  it("jeden współczynnik dla pary, nie max(paczki) + max(sztuki)", () => {
    // N=10: okno 30 d = 0 op. + 30 szt (30 szt), 90 d pary = 9 op. × 10 + 30 szt = 120 szt → 40 szt / 30 d
    const r = applyZdPairDemandFloor({
      policy: test,
      pack: { sprzedazOkres: 0, sprzedazDziennie: 0 },
      piece: { sprzedazOkres: 30, sprzedazDziennie: 1 },
      unitsPerPack: 10,
      sales90: 120,
      dniOkresu: 30,
    })!;
    const pairSales = (r.pack.sprzedazOkres ?? 0) * 10 + (r.piece?.sprzedazOkres ?? 0);
    expect(pairSales).toBeCloseTo(40); // per strona dałoby 30 + 30 = 60
    expect(r.floor).toMatchObject({ sales90: 120, rateBefore: 1 });
    expect(r.floor.rateAfter).toBeCloseTo(120 / 90);
  });

  it("brak sprzedaży w oknie — tempo 90 d idzie na stronę sztuk", () => {
    const r = applyZdPairDemandFloor({
      policy: test,
      pack: { sprzedazOkres: 0 },
      piece: { sprzedazOkres: 0 },
      unitsPerPack: 100,
      sales90: 900,
      dniOkresu: 30,
    })!;
    expect(r.pack.sprzedazOkres).toBe(0);
    expect(r.piece?.sprzedazOkres).toBeCloseTo(300);
  });

  it("okno wyższe niż średnia 90 d albo classic — bez zmian", () => {
    const pack = { sprzedazOkres: 5 };
    const piece = { sprzedazOkres: 100 };
    expect(applyZdPairDemandFloor({ policy: test, pack, piece, unitsPerPack: 10, sales90: 300, dniOkresu: 30 })).toBeNull();
    expect(
      applyZdPairDemandFloor({ policy: ZD_SUPPLIER_ORDER_POLICY_CLASSIC, pack, piece, unitsPerPack: 10, sales90: 9000, dniOkresu: 30 })
    ).toBeNull();
  });
});

describe("podłoga 90 d dla składników zestawów „Składamy”", () => {
  const policy: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 30, cycleDays: 3 };
  const zeros = (n: number) => Array.from({ length: n }, () => 0);

  it("jedna podłoga na łącznym popycie, nie max(składnik) + max(zestaw)", () => {
    // Zestaw: 30 w tym oknie, wcześniej 0. Składnik: 0 teraz, 45 + 45 w dwóch oknach przed.
    const lines = [
      { tw_Id: 100, tw_Symbol: "KIT", sprzedazOkres: 30, sprzedazDziennie: 1, celZapasu: 30, dostepne: 0 },
      { tw_Id: 1, tw_Symbol: "A", sprzedazOkres: 0, sprzedazDziennie: 0, celZapasu: 0, dostepne: 0 },
    ];
    applyZdBomDemandFloor({
      lines,
      explodeBoms: [{ parentTwId: 100, components: [{ componentTwId: 1, qtyPerParent: 1 }] }],
      profiles: new Map([
        [100, [...zeros(11), 30]],
        [1, [...zeros(9), 45, 45, 0]],
      ]),
      rawSalesByTw: new Map([
        [100, 30],
        [1, 0],
      ]),
      pairTwIds: new Set(),
      policy,
      dniOkresu: 30,
      dniZapasu: 30,
    });
    // Łącznie: max(30 w 30 d, 120 w 90 d → 40) = 40; zestaw dołoży 30 w expand.
    expect(lines[1]!.sprzedazOkres).toBeCloseTo(10);
    expect(lines[0]!.sprzedazOkres).toBe(30);
    const res = buildManualZdEstimateResult({ dniZapasu: 30, dniOkresu: 30, zapasMin: 0 }, lines, {
      salesTrack: false,
      productBoms: [
        {
          parentTwId: 100,
          stockAsCover: true,
          demandAllocation: "explode",
          purchaseTarget: "components",
          components: [{ componentTwId: 1, qtyPerParent: 1 }],
        },
      ],
    });
    const a = res.pozycje.find((p) => p.tw_Id === 1)!;
    expect(a.sprzedazOkres).toBeCloseTo(40);
    expect(a.doZamowieniaReczne).toBe(40);
  });

  it("brak profilu zestawu — bez podłogi (łączna średnia byłaby zaniżona)", () => {
    const lines = [
      { tw_Id: 100, sprzedazOkres: 30, celZapasu: 30 },
      { tw_Id: 1, sprzedazOkres: 0, celZapasu: 0 },
    ];
    const handled = applyZdBomDemandFloor({
      lines,
      explodeBoms: [{ parentTwId: 100, components: [{ componentTwId: 1, qtyPerParent: 1 }] }],
      profiles: new Map([[1, [...zeros(9), 45, 45, 0]]]),
      rawSalesByTw: new Map([
        [100, 30],
        [1, 0],
      ]),
      pairTwIds: new Set(),
      policy,
      dniOkresu: 30,
      dniZapasu: 30,
    });
    expect(lines[1]!.sprzedazOkres).toBe(0);
    // Nieobsłużony składnik wraca do własnej podłogi per linia w silniku.
    expect(handled.has(1)).toBe(false);
  });
});

describe("dni celu strategii - złe dane czasu dostawy", () => {
  const p: ZdSupplierOrderPolicy = { strategy: "max30_90", targetDays: 25, cycleDays: null };
  it("NaN czasu dostawy - tylko dni strategii", () => {
    expect(effectiveDniZapasu(p, 30, { leadDays: Number.NaN, nextOrderDays: 3 })).toBe(25);
  });
  it("dostawca na żądanie (kolejne zamówienie 0 dni): dostawa + bufor", () => {
    expect(effectiveDniZapasu(p, 30, { leadDays: 30, nextOrderDays: 0 })).toBe(38);
  });
});
