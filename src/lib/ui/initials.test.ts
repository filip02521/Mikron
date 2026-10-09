import { describe, expect, it } from "vitest";
import { initialsFromLabel } from "./initials";

describe("initialsFromLabel", () => {
  it("imię i nazwisko, e-mail, jedno słowo, pusto", () => {
    expect(initialsFromLabel("Anna Kowalska")).toBe("AK");
    expect(initialsFromLabel("anna.kowalska@mikran.com")).toBe("AK");
    expect(initialsFromLabel("Filip N.")).toBe("FN");
    expect(initialsFromLabel("zakupy")).toBe("ZA");
    expect(initialsFromLabel("  ")).toBe("?");
  });
});
