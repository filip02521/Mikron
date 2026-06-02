import { describe, expect, it } from "vitest";
import {
  isManagedSalesPersonEmail,
  isTeamSalesPerson,
  isUngroupedSalesPerson,
} from "./sales-person-catalog";

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

describe("isTeamSalesPerson", () => {
  it("wymaga grupy i firmowego e-maila", () => {
    expect(
      isTeamSalesPerson({
        name: "Kasia",
        email: "kasia@mikran.com",
        groupId: "g1",
      })
    ).toBe(true);
    expect(
      isTeamSalesPerson({
        name: "Import",
        email: "x@import.historia.mikran",
        groupId: "g1",
      })
    ).toBe(false);
    expect(
      isTeamSalesPerson({
        name: "Bez grupy",
        email: "kasia@mikran.com",
        groupId: null,
      })
    ).toBe(false);
  });
});

describe("isUngroupedSalesPerson", () => {
  it("wykrywa brak group_id", () => {
    expect(isUngroupedSalesPerson({ groupId: null })).toBe(true);
    expect(isUngroupedSalesPerson({ groupId: "g1" })).toBe(false);
  });
});
