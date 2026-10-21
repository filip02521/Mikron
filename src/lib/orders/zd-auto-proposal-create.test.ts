import { describe, expect, it } from "vitest";
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import { applyZdAutoProposalEdits, buildZdCreateInputFromAutoProposal, diffZdAutoProposalLines } from "./zd-auto-proposal-create";

const line = (twId: number, zdUnits: number, symbol = `S${twId}`): ZdAutoProposalLine => ({
  twId, symbol, nazwa: `Towar ${twId}`, zdUnits, pieces: zdUnits, unitLabel: "szt", priceNet: null, prosbaPieces: 0, floor: false,
});

const order = (id: string, over: Partial<ZdEstimatePendingIndividualOrder>): ZdEstimatePendingIndividualOrder => ({
  id, salesPersonId: "sp", salesPersonName: "H", products: "-", symbol: null, mikranCode: null,
  subiektTwId: null, qty: 1, requestNote: null, ...over,
});

describe("buildZdCreateInputFromAutoProposal", () => {
  it("linie w jednostkach ZD, zakres grupy, puste linie odrzucone", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 4), line(2, 0)],
      scope: { mode: "grupa", grupaId: 12, cechaId: null },
      pendingOrders: [],
    });
    expect(r.lines).toEqual([{ twId: 1, ilosc: 4, symbol: "S1" }]);
    expect([r.scopeMode, r.grtId, r.cechaId]).toEqual(["grupa", 12, null]);
  });

  it("zakres cechy przekazuje tylko cechaId", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 1)],
      scope: { mode: "cecha", grupaId: 5, cechaId: 7 },
      pendingOrders: [],
    });
    expect([r.scopeMode, r.grtId, r.cechaId]).toEqual(["cecha", null, 7]);
  });

  it("prośba na towar z ZD → katalog; bez dopasowania → usługa do uwag; na inny towar → nietknięta", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 3)],
      scope: { mode: "grupa", grupaId: 1, cechaId: null },
      pendingOrders: [
        order("p-on-zd", { subiektTwId: 1, qty: 2 }),
        order("p-service", { products: "coś spoza Subiekta" }),
        order("p-other", { subiektTwId: 99 }),
      ],
    });
    expect(r.individualCatalogOrderIds).toEqual(["p-on-zd"]);
    expect(r.individualServiceOrderIds).toEqual(["p-service"]);
    expect(r.extras.byTwId.get(1)?.requests.map((q) => q.orderId)).toEqual(["p-on-zd"]);
  });
});

describe("diffZdAutoProposalLines", () => {
  it("dodane, zmienione, bez zmian i usunięte (na końcu)", () => {
    const d = diffZdAutoProposalLines([line(1, 2), line(2, 5), line(3, 1)], [line(2, 6), line(1, 2), line(4, 3)]);
    expect(d.map((x) => [x.line.twId, x.change, x.beforeUnits])).toEqual([
      [2, "changed", 5],
      [1, "same", 2],
      [4, "added", null],
      [3, "removed", 1],
    ]);
  });
});

describe("applyZdAutoProposalEdits", () => {
  const pack = { ...line(2, 2), pieces: 200, unitLabel: "op." };
  it("zmienia ilość (sztuki w proporcji), 0 usuwa, reszta bez zmian", () => {
    const r = applyZdAutoProposalEdits([line(1, 3), pack, line(3, 1)], { "2": 5, "3": 0 });
    expect(r.ok && r.lines.map((l) => [l.twId, l.zdUnits, l.pieces])).toEqual([[1, 3, 3], [2, 5, 500]]);
  });
  it("odrzuca towar spoza propozycji i złą ilość", () => {
    expect(applyZdAutoProposalEdits([line(1, 3)], { "9": 1 }).ok).toBe(false);
    expect(applyZdAutoProposalEdits([line(1, 3)], { "1": 1.5 }).ok).toBe(false);
    expect(applyZdAutoProposalEdits([line(1, 3)], { "1": -1 }).ok).toBe(false);
    expect(applyZdAutoProposalEdits([line(1, 3)], { "1": 100000 }).ok).toBe(false);
  });
});
