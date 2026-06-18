import { describe, expect, it } from "vitest";
import { parseZdFulfillmentDeadline } from "./zd-fulfillment-date";

describe("parseZdFulfillmentDeadline", () => {
  it("preferuje dok_TerminRealizacji nad dok_DataRealizacji", () => {
    expect(
      parseZdFulfillmentDeadline({
        dok_TerminRealizacji: "2026-07-15",
        dok_DataRealizacji: "2026-07-01",
      })
    ).toBe("2026-07-15");
  });

  it("zwraca null gdy brak dat", () => {
    expect(
      parseZdFulfillmentDeadline({
        dok_TerminRealizacji: null,
        dok_DataRealizacji: null,
      })
    ).toBeNull();
  });
});
