import { describe, expect, it } from "vitest";
import {
  buildServicePartRows,
  servicePartStockState,
  summarizeServiceParts,
} from "./service-parts-overview";

describe("servicePartStockState", () => {
  it("classifies by available stock and minimum", () => {
    expect(servicePartStockState(0, 4)).toBe("brak");
    expect(servicePartStockState(-1, null)).toBe("brak");
    expect(servicePartStockState(1, 4)).toBe("ponizej_min");
    expect(servicePartStockState(4, 4)).toBe("ok");
    expect(servicePartStockState(2, null)).toBe("ok");
  });
});

describe("buildServicePartRows", () => {
  const rows = buildServicePartRows({
    products: [
      { tw_Id: 3, tw_Symbol: "CZ-F200-UCH", tw_Nazwa: "Uchwyt wiertła prostnicy Forte 200", tw_Stan: 6, tw_StanRez: 0 },
      { tw_Id: 1, tw_Symbol: "CZ-F200-LOZ", tw_Nazwa: "Łożysko prostnicy Forte 200", tw_Stan: 2, tw_StanRez: 2 },
      { tw_Id: 2, tw_Symbol: "CZ-F200-SZCZ", tw_Nazwa: "Szczotki silnika Forte 200", tw_Stan: 1, tw_StanRez: 0 },
      { tw_Id: 2, tw_Nazwa: "duplikat" },
    ],
    minStockByTwId: new Map([[2, 4]]),
    requestsByTwId: new Map([[1, [{ status: "Nowe" as const, quantity: "4", createdAt: "2026-11-03T08:00:00Z" }]]]),
  });

  it("subtracts reservations, dedupes and sorts missing first", () => {
    expect(rows.map((r) => [r.twId, r.available, r.state])).toEqual([
      [1, 0, "brak"],
      [2, 1, "ponizej_min"],
      [3, 6, "ok"],
    ]);
  });

  it("counts parts still to request", () => {
    expect(summarizeServiceParts(rows)).toEqual({
      total: 3,
      missing: 1,
      belowMin: 1,
      requested: 1,
      toRequest: 1,
    });
  });
});

describe("części pobrane do zleceń bez RW", () => {
  it("odejmują się od dostępnych, bo Subiekt jeszcze ich nie zdjął", () => {
    const [row] = buildServicePartRows({
      products: [{ tw_Id: 5, tw_Nazwa: "Szczotki", tw_Stan: 3, tw_StanRez: 1 }],
      minStockByTwId: new Map(),
      requestsByTwId: new Map(),
      takenWithoutRwByTwId: new Map([[5, 2]]),
    });
    expect(row).toMatchObject({ takenWithoutRw: 2, available: 0, state: "brak" });
  });
});
