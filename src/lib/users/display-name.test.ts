import { describe, expect, it } from "vitest";
import { displayNameFromEmail, resolveUserDisplayName } from "./display-name";

describe("displayNameFromEmail", () => {
  it("formatuje imie.nazwisko@domena", () => {
    expect(displayNameFromEmail("filip.naskret@mikran.com")).toBe("Filip Naskret");
    expect(displayNameFromEmail("aleksandra.stupczynska@mikran.com")).toBe(
      "Aleksandra Stupczynska"
    );
  });

  it("ignoruje wielkość liter w mailu", () => {
    expect(displayNameFromEmail("FILIP.NASKRET@mikran.com")).toBe("Filip Naskret");
  });

  it("zwraca null bez kropki w lokalnej części", () => {
    expect(displayNameFromEmail("admin@mikran.com")).toBeNull();
    expect(displayNameFromEmail("")).toBeNull();
  });
});

describe("resolveUserDisplayName", () => {
  it("preferuje kartę handlowca", () => {
    expect(
      resolveUserDisplayName({
        salesPersonName: "Jan Kowalski",
        email: "jan.kowalski@mikran.com",
      })
    ).toBe("Jan Kowalski");
  });

  it("fallback na mail", () => {
    expect(
      resolveUserDisplayName({
        email: "jan.kowalski@mikran.com",
      })
    ).toBe("Jan Kowalski");
  });
});
