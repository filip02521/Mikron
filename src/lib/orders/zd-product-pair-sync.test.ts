import { describe, expect, it } from "vitest";
import { filterKompletyForZdProductPairSync } from "./zd-product-pair-sync";

describe("filterKompletyForZdProductPairSync", () => {
  it("akceptuje komplet z 1 składnikiem i całkowitą liczbą ≥ 2", () => {
    const res = filterKompletyForZdProductPairSync([
      {
        kpl_Id: 1,
        kompletTwId: 10,
        skladnikTwId: 20,
        liczba: 100,
      },
    ]);
    expect(res.accepted).toHaveLength(1);
    expect(res.accepted[0]?.liczba).toBe(100);
    expect(res.skipped).toBe(0);
  });

  it("pomija komplety z ≠1 składnikiem", () => {
    const res = filterKompletyForZdProductPairSync([
      { kpl_Id: 1, kompletTwId: 10, skladnikTwId: 20, liczba: 50 },
      { kpl_Id: 2, kompletTwId: 10, skladnikTwId: 21, liczba: 50 },
      { kpl_Id: 3, kompletTwId: 30, skladnikTwId: 31, liczba: 10 },
    ]);
    expect(res.accepted.map((r) => r.kompletTwId)).toEqual([30]);
    expect(res.skippedMultiComponent).toBe(2);
    expect(res.skipped).toBe(2);
  });

  it("pomija niecałkowitą lub <2 liczbę", () => {
    const res = filterKompletyForZdProductPairSync([
      { kpl_Id: 1, kompletTwId: 1, skladnikTwId: 2, liczba: 1.5 },
      { kpl_Id: 2, kompletTwId: 3, skladnikTwId: 4, liczba: 1 },
    ]);
    expect(res.accepted).toHaveLength(0);
    expect(res.skipped).toBe(2);
  });
});
