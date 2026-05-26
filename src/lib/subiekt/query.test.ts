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
});
