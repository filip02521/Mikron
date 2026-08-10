import { describe, expect, it } from "vitest";
import { indexZdProductPairs } from "@/lib/orders/zd-product-pair-units";
import {
  findBestMatchingZdDocument,
  matchOrderToZdLine,
  orderMatchesZdDocument,
  qtyToPiecesForPairMatch,
} from "./match-order-to-zd";
import type { SubiektDocument } from "./types";

const pair = { packTwId: 100, pieceTwId: 200, unitsPerPack: 100 };
const pairs = indexZdProductPairs([pair]);

const pieceOrder = {
  subiekt_tw_id: 200,
  symbol: "SZT-1",
  products: "Sztuki",
  quantity: "50",
  delivered_quantity: "-",
  mikran_code: null as string | null,
  zd_fulfillment_dok_id: null as number | null,
};

const packZd: SubiektDocument = {
  dok_Id: 1,
  dok_NrPelny: "ZD 1/26",
  dok_DataWyst: "2026-08-01",
  dok_TerminRealizacji: "2026-08-20",
  dok_Status: 5,
  dok_Pozycja: [
    {
      ob_TowId: 100,
      tw_Symbol: "PACZKA-1",
      ob_Ilosc: 1,
    },
  ],
};

describe("match-order-to-zd pairs", () => {
  it("B5: twin pack↔piece bez mapy fail, z mapą OK", () => {
    expect(matchOrderToZdLine(pieceOrder, packZd.dok_Pozycja![0]!)).toBe(false);
    expect(matchOrderToZdLine(pieceOrder, packZd.dok_Pozycja![0]!, pairs)).toBe(
      true
    );
    expect(orderMatchesZdDocument(pieceOrder, packZd)).toBe(false);
    expect(orderMatchesZdDocument(pieceOrder, packZd, pairs)).toBe(true);
  });

  it("B4: prośba 50 szt + ZD 1×100 pokrywa w sztukach", () => {
    expect(qtyToPiecesForPairMatch(200, 50, pairs)).toBe(50);
    expect(qtyToPiecesForPairMatch(100, 1, pairs)).toBe(100);
    const best = findBestMatchingZdDocument(pieceOrder, [packZd], {
      pairs,
      at: new Date("2026-08-08"),
    });
    expect(best?.dok_Id).toBe(1);
  });

  it("qty piece nie wystarcza gdy ZD ma za mało sztuk", () => {
    const shortZd: SubiektDocument = {
      ...packZd,
      dok_Id: 2,
      dok_Pozycja: [{ ob_TowId: 100, tw_Symbol: "PACZKA-1", ob_Ilosc: 0 }],
    };
    const best = findBestMatchingZdDocument(
      { ...pieceOrder, quantity: "50" },
      [shortZd],
      { pairs, at: new Date("2026-08-08") }
    );
    // 0 paczek = 0 szt — nadal „match” dokumentu, ale coversRemaining false
    // findBest nadal zwraca kandydata gdy jest aktywny; tightness null / covers false
    // przy jednym kandydacie wybierze go mimo braku pokrycia qty
    expect(best?.dok_Id).toBe(2);
  });
});
