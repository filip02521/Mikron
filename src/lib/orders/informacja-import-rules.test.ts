import { describe, expect, it } from "vitest";
import {
  isInformacjaQuantityMarker,
  isStanSalesPersonLabel,
  shouldTreatAsInformacjaOnly,
} from "./informacja-import-rules";

describe("informacja-import-rules", () => {
  it("traktuje „-” i puste jako marker informacji", () => {
    expect(isInformacjaQuantityMarker("-")).toBe(true);
    expect(isInformacjaQuantityMarker("–")).toBe(true);
    expect(isInformacjaQuantityMarker("")).toBe(true);
    expect(isInformacjaQuantityMarker("2")).toBe(false);
  });

  it("rozpoznaje etykietę STAN z arkusza", () => {
    expect(isStanSalesPersonLabel("STAN")).toBe(true);
    expect(isStanSalesPersonLabel("NA STAN")).toBe(true);
    expect(isStanSalesPersonLabel("Kasia J. / STAN")).toBe(true);
    expect(isStanSalesPersonLabel("Kasia J.")).toBe(false);
  });

  it("łączy ilość „-” lub handlowca STAN (tylko import / backfill)", () => {
    expect(
      shouldTreatAsInformacjaOnly({
        quantity: "2",
        personLabel: "STAN",
        stanSalesPersonId: "stan-id",
        salesPersonId: "stan-id",
      })
    ).toBe(true);
    expect(
      shouldTreatAsInformacjaOnly({
        quantity: "-",
        personLabel: "Kasia J.",
      })
    ).toBe(true);
    expect(
      shouldTreatAsInformacjaOnly({
        quantity: "3",
        personLabel: "Kasia J.",
        stanSalesPersonId: "stan-id",
        salesPersonId: "other-id",
      })
    ).toBe(false);
  });
});
