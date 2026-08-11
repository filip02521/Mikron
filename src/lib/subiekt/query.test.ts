import { describe, expect, it } from "vitest";
import { subiektQueryString } from "./query";

describe("subiektQueryString", () => {
  it("pomija puste wartości", () => {
    expect(subiektQueryString({ page: 1, search: undefined })).toBe("?page=1");
  });

  it("zwraca pusty string bez parametrów", () => {
    expect(subiektQueryString({})).toBe("");
  });

  it("koduje wiele parametrów", () => {
    expect(subiektQueryString({ page: 2, pageSize: 20, search: "abc" })).toBe(
      "?page=2&pageSize=20&search=abc"
    );
  });

  it("includes cechaId for zd estimate filter", () => {
    expect(
      subiektQueryString({
        dniZapasu: 30,
        cechaId: 2738,
        page: 1,
        pageSize: 200,
      })
    ).toBe("?dniZapasu=30&cechaId=2738&page=1&pageSize=200");
  });

  it("includes grupaId without dropping other estimate params", () => {
    expect(
      subiektQueryString({
        grupaId: 12,
        cechaId: undefined,
        dniZapasu: 45,
      })
    ).toBe("?grupaId=12&dniZapasu=45");
  });
});
