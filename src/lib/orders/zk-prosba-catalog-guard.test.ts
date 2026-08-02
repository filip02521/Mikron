import { describe, expect, it } from "vitest";
import {
  assertProsbaLinesBelongToZk,
  prosbaLineViolatesZkCatalog,
  ZK_PROSBA_OFF_CATALOG_MESSAGE,
} from "./zk-prosba-catalog-guard";

describe("zk-prosba-catalog-guard", () => {
  const allowed = new Set([10, 20]);

  it("akceptuje linię z tw_Id z allowlisty", () => {
    expect(
      prosbaLineViolatesZkCatalog({ product: "A", subiektTwId: 10 }, allowed)
    ).toBe(false);
  });

  it("odrzuca linię z tw_Id spoza ZK", () => {
    expect(
      prosbaLineViolatesZkCatalog({ product: "A", subiektTwId: 99 }, allowed)
    ).toBe(true);
  });

  it("odrzuca linię z produktem bez tw_Id", () => {
    expect(prosbaLineViolatesZkCatalog({ product: "Free text" }, allowed)).toBe(true);
  });

  it("ignoruje puste linie", () => {
    expect(prosbaLineViolatesZkCatalog({ product: "" }, allowed)).toBe(false);
  });

  it("assert rzuca przy naruszeniu", () => {
    expect(() =>
      assertProsbaLinesBelongToZk([{ product: "X", subiektTwId: 1 }], allowed)
    ).toThrow(ZK_PROSBA_OFF_CATALOG_MESSAGE);
  });

  it("assert nie blokuje przy pustej allowliście", () => {
    expect(() =>
      assertProsbaLinesBelongToZk([{ product: "X", subiektTwId: 1 }], new Set())
    ).not.toThrow();
  });
});
