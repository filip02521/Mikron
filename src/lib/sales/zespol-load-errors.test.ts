import { describe, expect, it } from "vitest";
import { zespolLoadErrorMessage, ZESPOL_MIGRATION_HINT } from "./zespol-load-errors";

describe("zespolLoadErrorMessage", () => {
  it("zwraca message z błędu gdy jest Error", () => {
    expect(zespolLoadErrorMessage(new Error("Brak tabeli sales_groups"), "groups")).toBe(
      "Brak tabeli sales_groups"
    );
  });

  it("używa jednolitego fallbacku z migracją", () => {
    expect(zespolLoadErrorMessage(null, "team")).toBe(
      `Nie udało się wczytać zespołu. ${ZESPOL_MIGRATION_HINT}`
    );
    expect(zespolLoadErrorMessage(undefined, "people")).toContain("listy handlowców");
    expect(zespolLoadErrorMessage(undefined, "groups")).toContain(ZESPOL_MIGRATION_HINT);
  });
});
