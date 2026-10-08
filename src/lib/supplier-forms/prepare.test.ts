import { describe, expect, it } from "vitest";
import { zdFormLines } from "@/lib/supplier-forms/prepare";

describe("zdFormLines", () => {
  it("trzyma kolejność pozycji z ZD (ob_Id), nie alfabet", () => {
    const lines = zdFormLines([
      { ob_Id: 503, ob_TowId: 3, tw_Symbol: "529479", tw_Nazwa: "Chromascop", ob_Ilosc: 4 },
      { ob_Id: 501, ob_TowId: 1, tw_Symbol: "605329", tw_Nazwa: "IPS e.max CAD LT A2 C14/5", ob_Ilosc: 15 },
      { ob_Id: 502, ob_TowId: 2, tw_Symbol: "540308", tw_Nazwa: "Szafka na zęby Ivoclar", ob_Ilosc: 2 },
    ]);
    expect(lines.map((l) => l.symbol)).toEqual(["605329", "540308", "529479"]);
  });
});
