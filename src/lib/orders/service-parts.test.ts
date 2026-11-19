import { describe, expect, it } from "vitest";
import {
  mergeServicePartsIntoOnRequests,
  normalizeCechaName,
  parseServicePartsCechaSetting,
  pickServicePartsCechaId,
  servicePartTwIdSet,
} from "./service-parts";

type Row = { subiektTwId: number; note: string; origin?: "service_cecha" };
const make = (id: number): Row => ({ subiektTwId: id, note: "cecha", origin: "service_cecha" });

describe("normalizeCechaName", () => {
  it("ignores case, extra spaces and decomposed diacritics", () => {
    expect(normalizeCechaName("  CZĘŚCI   serwisowe ")).toBe("części serwisowe");
    expect(normalizeCechaName("Części serwisowe")).toBe("części serwisowe");
  });
});

describe("pickServicePartsCechaId", () => {
  it("finds the cecha by name", () => {
    expect(
      pickServicePartsCechaId([
        { scopeId: 10, name: "Ivoclar Technical" },
        { scopeId: 2741, name: "Części Serwisowe" },
      ])
    ).toBe(2741);
  });
  it("returns null when absent", () => {
    expect(pickServicePartsCechaId([{ scopeId: 1, name: "Serwis" }])).toBeNull();
  });
});

describe("parseServicePartsCechaSetting", () => {
  it("accepts positive id only", () => {
    expect(parseServicePartsCechaSetting({ cechaId: 12 })).toBe(12);
    expect(parseServicePartsCechaSetting({ cechaId: 0 })).toBeNull();
    expect(parseServicePartsCechaSetting(null)).toBeNull();
    expect(parseServicePartsCechaSetting("12")).toBeNull();
  });
});

describe("mergeServicePartsIntoOnRequests", () => {
  it("keeps manual rows (with their note) and appends cecha rows without duplicates", () => {
    const manual: Row[] = [{ subiektTwId: 5, note: "ręcznie" }, { subiektTwId: 6, note: "zwykły" }];
    const merged = mergeServicePartsIntoOnRequests(manual, [5, 7, 7, 0, -1], make);
    expect(merged).toEqual([
      { subiektTwId: 5, note: "ręcznie", origin: "service_cecha" },
      { subiektTwId: 6, note: "zwykły" },
      { subiektTwId: 7, note: "cecha", origin: "service_cecha" },
    ]);
  });
  it("a manual entry of a part with the cecha is still a service part (cecha decides)", () => {
    const merged = mergeServicePartsIntoOnRequests([{ subiektTwId: 5, note: "" }, { subiektTwId: 9, note: "" }], [8, 5], make);
    expect([...servicePartTwIdSet(merged)].sort()).toEqual([5, 8]);
  });
});
