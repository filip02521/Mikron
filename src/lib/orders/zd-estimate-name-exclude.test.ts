import { describe, expect, it } from "vitest";
import {
  isWycofaneNameToken,
  matchZdNameAutoExclude,
  mapZdNameAutoExcludedByTwId,
  mergeZdEstimateExcludedTwIds,
  formatZdNameAutoExcludeBadge,
  ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX,
} from "./zd-estimate-name-exclude";

describe("isWycofaneNameToken", () => {
  it("pełne i formy pokrewne", () => {
    expect(isWycofaneNameToken("wycofane")).toBe(true);
    expect(isWycofaneNameToken("WYCOFANY")).toBe(true);
    expect(isWycofaneNameToken("wycofana")).toBe(true);
    expect(isWycofaneNameToken("wycofanych")).toBe(true);
    expect(isWycofaneNameToken("wycofanie")).toBe(true);
  });

  it("ucięcia prefiksu wycofane (≥ min)", () => {
    expect(isWycofaneNameToken("wycofan")).toBe(true);
    expect(isWycofaneNameToken("wycofa")).toBe(true);
    expect(isWycofaneNameToken("wycof")).toBe(true);
    expect("wycof".length).toBe(ZD_NAME_EXCLUDE_WYCOFANE_MIN_PREFIX);
  });

  it("za krótkie / nieprefiks — bez trafienia", () => {
    expect(isWycofaneNameToken("wyco")).toBe(false);
    expect(isWycofaneNameToken("wy")).toBe(false);
    expect(isWycofaneNameToken("cofane")).toBe(false);
    expect(isWycofaneNameToken("wycof12")).toBe(false);
    expect(isWycofaneNameToken("nawykof")).toBe(false);
  });
});

describe("matchZdNameAutoExclude", () => {
  it("outlet w nazwie (case / separator)", () => {
    expect(matchZdNameAutoExclude("Freza OUTLET 2.0")?.reason).toBe("outlet");
    expect(matchZdNameAutoExclude("Produkt (outlet)")?.reason).toBe("outlet");
    expect(matchZdNameAutoExclude("X-Outlet-Y")?.matched).toBe("outlet");
  });

  it("wycofane pełne i ucięte na końcu nazwy", () => {
    expect(
      matchZdNameAutoExclude("Wiertło diamentowe WYCOFANE")?.reason
    ).toBe("wycofane");
    // Typowe ucięcie limitu znaków Subiekta:
    expect(matchZdNameAutoExclude("Bardzo długa nazwa towaru WYCOFAN")?.matched).toBe(
      "wycofan"
    );
    expect(matchZdNameAutoExclude("Nazwa… WYCOFA")?.matched).toBe("wycofa");
    expect(matchZdNameAutoExclude("Nazwa WYCOF")?.matched).toBe("wycof");
  });

  it("ucięcie sklejone bez spacji (limit znaków Subiekta)", () => {
    expect(matchZdNameAutoExclude("ProduktWYCOFA")?.reason).toBe("wycofane");
    expect(
      matchZdNameAutoExclude("BardzoDlugaNazwaTowaruBezSpacjiWYCOFAN")?.matched
    ).toBe("wycofan");
    expect(matchZdNameAutoExclude("Xwycofane")?.matched).toBe("wycofane");
    expect(matchZdNameAutoExclude("Modelwycofany")?.matched).toBe("wycofany");
  });

  it("outlet ma pierwszeństwo przed wycofane", () => {
    expect(
      matchZdNameAutoExclude("OUTLET wycofane")?.reason
    ).toBe("outlet");
  });

  it("zwykła nazwa — null", () => {
    expect(matchZdNameAutoExclude("Freza H364")).toBeNull();
    expect(matchZdNameAutoExclude("")).toBeNull();
    expect(matchZdNameAutoExclude("Produkt wyco")).toBeNull();
    expect(matchZdNameAutoExclude("ProduktWYCO")).toBeNull();
  });
});

describe("mergeZdEstimateExcludedTwIds", () => {
  it("łączy DB + auto z nazwy", () => {
    const set = mergeZdEstimateExcludedTwIds(
      [
        { tw_Id: 1, tw_Nazwa: "Normalny" },
        { tw_Id: 2, tw_Nazwa: "Coś OUTLET" },
        { tw_Id: 3, tw_Nazwa: "Stary WYCOFA" },
      ],
      [10, 2]
    );
    expect([...set].sort((a, b) => a - b)).toEqual([2, 3, 10]);
  });

  it("dodaje katalog zębów (przyszłe SKU z admina)", () => {
    const set = mergeZdEstimateExcludedTwIds(
      [
        { tw_Id: 1, tw_Nazwa: "Normalny" },
        { tw_Id: 99, tw_Nazwa: "Ivoclar Ivostar A2" },
      ],
      [10],
      { teethTwIds: [99, 100] }
    );
    expect([...set].sort((a, b) => a - b)).toEqual([10, 99, 100]);
  });
});

describe("mapZdNameAutoExcludedByTwId + zęby", () => {
  it("zęby z katalogu; outlet wygrywa z teeth", () => {
    const map = mapZdNameAutoExcludedByTwId(
      [
        { tw_Id: 1, tw_Nazwa: "Zwykły" },
        { tw_Id: 2, tw_Nazwa: "Ząb A" },
        { tw_Id: 3, tw_Nazwa: "Ząb OUTLET" },
      ],
      { teethTwIds: [2, 3] }
    );
    expect(map.get(1)).toBeUndefined();
    expect(map.get(2)?.reason).toBe("teeth");
    expect(map.get(3)?.reason).toBe("outlet");
  });

  it("badge label zębów", () => {
    expect(formatZdNameAutoExcludeBadge("teeth")).toBe("auto · zęby");
  });
});
