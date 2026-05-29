import { describe, expect, it } from "vitest";
import { isManagedSalesPersonEmail } from "./sales-person-catalog";

describe("isManagedSalesPersonEmail", () => {
  it("akceptuje kartę z admina", () => {
    expect(isManagedSalesPersonEmail("kasia.jasiewicz@mikran.com")).toBe(true);
  });

  it("odrzuca wpis z importu historii", () => {
    expect(
      isManagedSalesPersonEmail("kamil.niewada.clinic@import.historia.mikran")
    ).toBe(false);
  });
});
