import { describe, expect, it } from "vitest";
import { scoreCompanyNameMatch, stripCompanyLegalForm } from "./company-name-match";

describe("stripCompanyLegalForm", () => {
  it("usuwa sp. z o.o. i sp. k.", () => {
    expect(stripCompanyLegalForm("Renfert Polska Sp. z o.o.")).toBe("renfert polska");
    expect(stripCompanyLegalForm("Renfert Polska sp. k.")).toBe("renfert polska");
  });
});

describe("scoreCompanyNameMatch", () => {
  it("wysoki wynik dla tej samej marki przy innej formie prawnej", () => {
    const r = scoreCompanyNameMatch(
      "REN — Renfert Polska sp. z o.o.",
      "Renfert Polska sp. k."
    );
    expect(r.score).toBeGreaterThanOrEqual(85);
  });

  it("dopasowuje skróconą nazwę dostawcy w aplikacji", () => {
    const r = scoreCompanyNameMatch(
      "Ivoclar-Vivadent Polska sp. z o.o.",
      "Ivoclar"
    );
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it("niski wynik dla obcych firm", () => {
    const r = scoreCompanyNameMatch("ABC Dental GmbH", "Renfert");
    expect(r.score).toBeLessThan(55);
  });
});
