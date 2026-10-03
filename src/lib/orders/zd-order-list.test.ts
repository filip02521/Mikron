import { describe, expect, it } from "vitest";
import { buildZdOrderList } from "@/lib/orders/zd-order-list";
import { mapZdEstimateLineToManual } from "@/lib/orders/zd-estimate-manual";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import type { PackagingLookup } from "@/lib/orders/zd-estimate-packaging";

function line(tw: number, over: { celZapasu?: number; dostepne?: number; otwarteZd?: number } = {}) {
  return mapZdEstimateLineToManual({
    tw_Id: tw,
    tw_Symbol: `S${tw}`,
    tw_Nazwa: `Towar ${tw}`,
    celZapasu: over.celZapasu ?? 40,
    dostepne: over.dostepne ?? 10,
    otwarteZd: over.otwarteZd ?? 0,
    doZamowienia: 0,
  });
}

function prosba(tw: number, qty: number): ZdEstimatePendingIndividualOrder {
  return {
    id: `o${tw}`,
    salesPersonId: "sp1",
    salesPersonName: "Handlowiec",
    products: `Towar ${tw}`,
    symbol: `S${tw}`,
    mikranCode: null,
    subiektTwId: tw,
    qty,
    requestNote: null,
  };
}

function build(over: Partial<Parameters<typeof buildZdOrderList>[0]> = {}) {
  return buildZdOrderList({
    lines: [line(1), line(2, { dostepne: 50 }), line(3)],
    packagingLookup: new Map(),
    hardExcludedTwIds: new Set(),
    onRequestTwIds: new Set(),
    productPairs: [],
    bomRefs: [],
    missingBomTwIds: [],
    teethTwIds: [],
    pendingIndividuals: [],
    prosbaReservedByTwId: new Map(),
    extrasPolicy: "sum",
    minStockByTwId: null,
    ...over,
  });
}

describe("buildZdOrderList", () => {
  it("lista = pozycje z ilością > 0 (jak „Do ZD” w Kreatorze)", () => {
    const res = build();
    expect(res.lines.map((l) => [l.line.tw_Id, l.zdUnits])).toEqual([
      [1, 30],
      [3, 30],
    ]);
    expect(res.lines[0]).toEqual(
      expect.objectContaining({ piecesArriving: 30, packagesMode: false, unitsPerPackage: null })
    );
  });

  it("opakowania: ilość w paczkach, sztuki po dostawie", () => {
    const packagingLookup = new Map<number, PackagingLookup>([
      [1, { unitsPerPackage: 12, packageLabel: "kart.", documentUnitMode: "packages" }],
    ]);
    const first = build({ packagingLookup }).lines[0]!;
    expect(first).toEqual(
      expect.objectContaining({
        zdUnits: 3,
        piecesArriving: 36,
        packagesMode: true,
        packageLabel: "kart.",
        unitsPerPackage: 12,
      })
    );
  });

  it("wykluczone i „na prośbę” bez prośby wypadają", () => {
    const res = build({ hardExcludedTwIds: new Set([1]), onRequestTwIds: new Set([3]) });
    expect(res.lines).toEqual([]);
  });

  it("„na prośbę” z prośbą handlowca wchodzi tylko z ilością prośby", () => {
    const res = build({
      onRequestTwIds: new Set([3]),
      pendingIndividuals: [prosba(3, 4)],
    });
    expect(res.extraOnlyTwIds.has(3)).toBe(true);
    const hit = res.lines.find((l) => l.line.tw_Id === 3);
    expect(hit).toEqual(expect.objectContaining({ zdUnits: 4, individualExtraPieces: 4 }));
  });

  it("prośby nieczytelne (null) - bez extraOnly, jak Kreator z błędem próśb", () => {
    const res = build({ onRequestTwIds: new Set([3]), pendingIndividuals: null });
    expect(res.extraOnlyTwIds.size).toBe(0);
    expect(res.lines.some((l) => l.line.tw_Id === 3)).toBe(false);
  });
});
