import { describe, expect, it } from "vitest";
import { formatSubmitResult } from "./prosba-submit-result-copy";

describe("formatSubmitResult", () => {
  it("handlowiec — pełna realizacja", () => {
    expect(
      formatSubmitResult({ count: 2, complete: 2, verification: 0 }, "zamowienie", true)
    ).toBe("Prośba zapisana.");
  });

  it("handlowiec — tylko weryfikacja", () => {
    expect(
      formatSubmitResult({ count: 1, complete: 0, verification: 1 }, "zamowienie", true)
    ).toContain("dział zakupów dopracuje szczegóły");
  });

  it("handlowiec — mieszany wynik", () => {
    expect(
      formatSubmitResult({ count: 3, complete: 2, verification: 1 }, "zamowienie", true)
    ).toContain("2 od razu do realizacji, 1 do weryfikacji");
  });

  it("informacja dla handlowca", () => {
    expect(
      formatSubmitResult({ count: 1, complete: 1, verification: 0 }, "informacja", true)
    ).toBe("Prośba o dostępność zapisana.");
  });
});
