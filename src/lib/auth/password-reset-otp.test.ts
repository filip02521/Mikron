import { describe, expect, it } from "vitest";
import { maskEmailForDisplay } from "@/lib/auth/mask-email";
import {
  generatePasswordResetOtpCode,
  hashPasswordResetOtpCode,
  isValidPasswordResetOtpCode,
  verifyPasswordResetOtpHash,
} from "@/lib/auth/password-reset-otp";

describe("maskEmailForDisplay", () => {
  it("maskuje lokalną część adresu", () => {
    expect(maskEmailForDisplay("jan.kowalski@firma.pl")).toBe("j***@firma.pl");
  });
});

describe("password reset otp helpers", () => {
  it("generuje 6-cyfrowy kod", () => {
    const code = generatePasswordResetOtpCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("weryfikuje poprawny hash kodu", () => {
    const hash = hashPasswordResetOtpCode("123456", "user-1");
    expect(verifyPasswordResetOtpHash("123456", "user-1", hash)).toBe(true);
    expect(verifyPasswordResetOtpHash("654321", "user-1", hash)).toBe(false);
  });

  it("waliduje format kodu", () => {
    expect(isValidPasswordResetOtpCode("123456")).toBe(true);
    expect(isValidPasswordResetOtpCode("12345")).toBe(false);
    expect(isValidPasswordResetOtpCode("12a456")).toBe(false);
  });
});
