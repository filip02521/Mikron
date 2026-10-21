import { describe, expect, it } from "vitest";
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdEstimatePendingIndividualOrder } from "@/lib/orders/zd-estimate-individual";
import {
  applyZdAutoProposalEdits,
  buildZdCreateInputFromAutoProposal,
  diffZdAutoProposalLines,
  zdAutoProposalBlockReason,
} from "./zd-auto-proposal-create";

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
      serviceOrderIds: [],
    });
    expect(r.lines).toEqual([{ twId: 1, ilosc: 4, symbol: "S1", plu: null }]);
    expect([r.scopeMode, r.grtId, r.cechaId]).toEqual(["grupa", 12, null]);
  });

  it("zakres cechy przekazuje tylko cechaId", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 1)],
      scope: { mode: "cecha", grupaId: 5, cechaId: 7 },
      pendingOrders: [],
      serviceOrderIds: [],
    });
    expect([r.scopeMode, r.grtId, r.cechaId]).toEqual(["cecha", null, 7]);
  });

  it("prośba na towar z ZD → katalog; usługa automatu → uwagi; prośba spoza ZD bez usługi → nietknięta", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 3)],
      scope: { mode: "grupa", grupaId: 1, cechaId: null },
      pendingOrders: [
        order("p-on-zd", { subiektTwId: 1, qty: 2 }),
        order("p-service", { products: "coś spoza Subiekta" }),
        order("p-other", { subiektTwId: 99 }),
        order("p-off-zd", { products: "towar z zakresu, którego dziś nie zamawiamy" }),
      ],
      serviceOrderIds: ["p-service"],
    });
    expect(r.individualCatalogOrderIds).toEqual(["p-on-zd"]);
    expect(r.individualServiceOrderIds).toEqual(["p-service"]);
    expect(r.extras.byTwId.get(1)?.requests.map((q) => q.orderId)).toEqual(["p-on-zd"]);
    expect(r.extras.serviceLines.flatMap((x) => x.requests.map((q) => q.orderId))).toEqual(["p-service"]);
  });

  it("prośba z samym kodem Mikran trafia na towar po PLU; lineMeta z propozycji", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [{ ...line(5, 2), plu: "896", celAtLink: 12, deltaAtLink: 3 }],
      scope: { mode: "grupa", grupaId: 1, cechaId: null },
      pendingOrders: [order("p-mikran", { mikranCode: "896", qty: 1 })],
      serviceOrderIds: [],
    });
    expect(r.individualCatalogOrderIds).toEqual(["p-mikran"]);
    expect(r.lines[0]?.plu).toBe("896");
    expect(r.lineMeta).toEqual([{ twId: 5, celAtLink: 12, deltaAtLink: 3 }]);
  });

  it("propozycja bez listy usług (sprzed migracji) nie dopisuje usług", () => {
    const r = buildZdCreateInputFromAutoProposal({
      lines: [line(1, 1)],
      scope: { mode: "grupa", grupaId: 1, cechaId: null },
      pendingOrders: [order("p-service", { products: "coś spoza Subiekta" })],
      serviceOrderIds: null,
    });
    expect(r.individualServiceOrderIds).toEqual([]);
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

describe("zdAutoProposalBlockReason", () => {
  const ok = {
    fetchTruncated: false, strategyActive: true, salesProfileFailed: false, explodeBomIncomplete: false,
    pendingIndividualsError: null, pendingIndividualsLoaded: true, pendingIndividualsTruncated: false,
    prosbaOverlapCandidateCount: 0, prosbaOverlapResolved: true, historyFetchFailed: false, packagingPairConflictCount: 0,
  };
  it("pełne dane → brak blokady", () => expect(zdAutoProposalBlockReason(ok)).toBeNull());
  it("blokuje jak Kreator: prośby, rezerwacje, historia, konflikt opakowań", () => {
    expect(zdAutoProposalBlockReason({ ...ok, pendingIndividualsLoaded: false })).toMatch(/próśb/);
    expect(zdAutoProposalBlockReason({ ...ok, pendingIndividualsTruncated: true })).toMatch(/500/);
    expect(zdAutoProposalBlockReason({ ...ok, prosbaOverlapCandidateCount: 2, prosbaOverlapResolved: false })).toMatch(/rezerwacji/);
    expect(zdAutoProposalBlockReason({ ...ok, historyFetchFailed: true })).toMatch(/historii/);
    expect(zdAutoProposalBlockReason({ ...ok, packagingPairConflictCount: 1 })).toMatch(/para/);
  });
  it("brak profilu blokuje tylko strategię", () => {
    expect(zdAutoProposalBlockReason({ ...ok, salesProfileFailed: true })).toMatch(/Profil/);
    expect(zdAutoProposalBlockReason({ ...ok, salesProfileFailed: true, strategyActive: false })).toBeNull();
  });
});
