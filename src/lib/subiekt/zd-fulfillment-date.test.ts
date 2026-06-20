import { describe, expect, it } from "vitest";
import {
  isActiveZdFulfillmentDeadline,
  isActiveZdFulfillmentDocument,
  parseZdFulfillmentDeadline,
} from "./zd-fulfillment-date";

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

  it("odrzuca niepoprawne daty", () => {
    expect(
      parseZdFulfillmentDeadline({
        dok_TerminRealizacji: "not-a-date",
        dok_DataRealizacji: null,
      })
    ).toBeNull();
  });
});

describe("isActiveZdFulfillmentDeadline", () => {
  const at = new Date("2026-06-18T12:00:00+02:00");

  it("termin dziś lub w przyszłości — aktywny", () => {
    expect(isActiveZdFulfillmentDeadline("2026-06-18", at)).toBe(true);
    expect(isActiveZdFulfillmentDeadline("2026-07-15", at)).toBe(true);
  });

  it("termin w przeszłości — nieaktywny (już zrealizowany)", () => {
    expect(isActiveZdFulfillmentDeadline("2026-02-27", at)).toBe(false);
    expect(isActiveZdFulfillmentDeadline(null, at)).toBe(false);
  });

  it("isActiveZdFulfillmentDocument na dokumencie", () => {
    expect(
      isActiveZdFulfillmentDocument(
        { dok_TerminRealizacji: "2026-07-15" },
        at
      )
    ).toBe(true);
    expect(
      isActiveZdFulfillmentDocument(
        { dok_TerminRealizacji: "2026-02-27" },
        at
      )
    ).toBe(false);
  });
});
