import { describe, expect, it } from "vitest";
import { splitExpandedDeliveryEstimate } from "@/components/moje/MyOrderExpandedDeliveryTiming";

describe("splitExpandedDeliveryEstimate", () => {
  it("rozdziela datę i numer ZD po znanym dokNr", () => {
    expect(
      splitExpandedDeliveryEstimate("Wt 01.09.2026 · ZD 157/M/08/2026", "ZD 157/M/08/2026")
    ).toEqual({
      datePart: "Wt 01.09.2026",
      docPart: "ZD 157/M/08/2026",
    });
  });

  it("rozpoznaje ZD na końcu bez znanego dokNr", () => {
    expect(splitExpandedDeliveryEstimate("01.09.2026 · ZD 157/M/08/2026")).toEqual({
      datePart: "01.09.2026",
      docPart: "ZD 157/M/08/2026",
    });
  });

  it("zostawia samą datę gdy brak ZD", () => {
    expect(splitExpandedDeliveryEstimate("01.09.2026 · ~4 dni rob.")).toEqual({
      datePart: "01.09.2026 · ~4 dni rob.",
      docPart: null,
    });
  });
});
