import { describe, expect, it } from "vitest";
import {
  buildPasswordConfirmLink,
  emailOtpTypeFromVerification,
  safePasswordSetupNextPath,
} from "./password-link-redirect";

describe("password-link-redirect", () => {
  it("safePasswordSetupNextPath rejects open redirects", () => {
    expect(safePasswordSetupNextPath(null)).toBe("/ustaw-haslo");
    expect(safePasswordSetupNextPath("//evil.com")).toBe("/ustaw-haslo");
    expect(safePasswordSetupNextPath("/admin")).toBe("/ustaw-haslo");
    expect(safePasswordSetupNextPath("/ustaw-haslo?wymagane=1")).toBe(
      "/ustaw-haslo?wymagane=1"
    );
    expect(safePasswordSetupNextPath("/ustaw-haslo?wymagane=1&evil=1")).toBe(
      "/ustaw-haslo"
    );
  });

  it("emailOtpTypeFromVerification maps generateLink types", () => {
    expect(emailOtpTypeFromVerification("invite")).toBe("invite");
    expect(emailOtpTypeFromVerification("recovery")).toBe("recovery");
    expect(emailOtpTypeFromVerification("unknown")).toBe("recovery");
  });

  it("buildPasswordConfirmLink encodes token_hash and type", () => {
    const link = buildPasswordConfirmLink(
      "hash123",
      "invite",
      "/ustaw-haslo",
      "http://ontime.mikran.pl:3000"
    );
    const url = new URL(link);
    expect(url.origin).toBe("http://ontime.mikran.pl:3000");
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("hash123");
    expect(url.searchParams.get("type")).toBe("invite");
    expect(url.searchParams.get("next")).toBe("/ustaw-haslo");
  });
});
