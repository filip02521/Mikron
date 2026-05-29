import { describe, expect, it } from "vitest";
import {
  fallbackKontrahentDisplay,
  kontrahentDisplayName,
} from "./resolve-kontrahent-labels";

describe("kontrahentDisplayName", () => {
  it("używa nazwy z Subiekta", () => {
    expect(kontrahentDisplayName("REN — Renfert GmbH", 688)).toBe("REN — Renfert GmbH");
  });

  it("fallback gdy brak nazwy", () => {
    expect(kontrahentDisplayName(null, 688)).toBe(fallbackKontrahentDisplay(688));
  });
});
