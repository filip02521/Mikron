import { describe, expect, it } from "vitest";
import {
  evaluatePasswordRequirements,
  isPasswordValid,
  passwordValidationError,
  validateNewPasswordPair,
} from "./password-policy";

describe("password-policy", () => {
  it("requires min length, letter and digit", () => {
    expect(isPasswordValid("short1")).toBe(false);
    expect(isPasswordValid("abcdefgh")).toBe(false);
    expect(isPasswordValid("12345678")).toBe(false);
    expect(isPasswordValid("Haslo123")).toBe(true);
  });

  it("evaluates requirements individually", () => {
    const evaluated = evaluatePasswordRequirements("Abc1");
    expect(evaluated.find((r) => r.id === "minLength")?.met).toBe(false);
    expect(evaluated.find((r) => r.id === "hasLetter")?.met).toBe(true);
    expect(evaluated.find((r) => r.id === "hasDigit")?.met).toBe(true);
  });

  it("returns polish validation messages", () => {
    expect(passwordValidationError("kr")).toMatch(/8 znaków/);
    expect(passwordValidationError("12345678")).toMatch(/literę/);
    expect(passwordValidationError("abcdefgh")).toMatch(/cyfrę/);
    expect(passwordValidationError("Haslo123")).toBeNull();
  });

  it("validates password pair", () => {
    expect(validateNewPasswordPair("Haslo123", "Haslo123")).toBeNull();
    expect(validateNewPasswordPair("Haslo123", "inne")).toMatch(/identyczne/);
    expect(validateNewPasswordPair("krót", "krót")).toMatch(/8 znaków/);
  });
});
