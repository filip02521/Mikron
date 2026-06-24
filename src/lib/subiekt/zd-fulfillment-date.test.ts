import { describe, expect, it } from "vitest";
import {
  isActiveZdFulfillmentDeadline,
  isActiveZdFulfillmentDocument,
  isFulfilledZdDocumentStatus,
  partitionZdListItemsForEtaLoad,
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

  it("termin w przeszłości — nieaktywny", () => {
    expect(isActiveZdFulfillmentDeadline("2026-02-27", at)).toBe(false);
    expect(isActiveZdFulfillmentDeadline(null, at)).toBe(false);
  });

  it("isActiveZdFulfillmentDocument bez statusu — wg terminu", () => {
    expect(
      isActiveZdFulfillmentDocument({ dok_TerminRealizacji: "2026-07-15" }, at)
    ).toBe(true);
    expect(
      isActiveZdFulfillmentDocument({ dok_TerminRealizacji: "2026-02-27" }, at)
    ).toBe(false);
  });

  it("pomija ZD ze statusem Zrealizowane (8), nawet z przyszłym terminem", () => {
    expect(isFulfilledZdDocumentStatus({ dok_Status: 8 })).toBe(true);
    expect(
      isActiveZdFulfillmentDocument(
        { dok_Status: 8, dok_TerminRealizacji: "2099-01-01" },
        at
      )
    ).toBe(false);
  });

  it("uwzględnia ZD niezrealizowane (5/6/7)", () => {
    for (const status of [5, 6, 7]) {
      expect(
        isActiveZdFulfillmentDocument(
          { dok_Status: status, dok_TerminRealizacji: "2026-07-15" },
          at
        )
      ).toBe(true);
    }
  });
});

describe("partitionZdListItemsForEtaLoad", () => {
  it("najpierw niezrealizowane (5/6/7), potem reszta bez pomijanych", () => {
    const { open, later } = partitionZdListItemsForEtaLoad([
      { dok_Id: 1, dok_Status: 8 },
      { dok_Id: 2, dok_Status: 6 },
      { dok_Id: 3, dok_Status: null },
      { dok_Id: 4, dok_Status: 7 },
      { dok_Id: 5, dok_Status: 99 },
    ]);
    expect(open.map((r) => r.dok_Id)).toEqual([2, 4]);
    expect(later.map((r) => r.dok_Id)).toEqual([3]);
  });
});
