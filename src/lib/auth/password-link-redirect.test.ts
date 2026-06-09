import { describe, expect, it } from "vitest";
import {
  buildPasswordConfirmLink,
  safePasswordSetupNextPath,
} from "./password-link-redirect";

describe("password-link-redirect", () => {
  it("safePasswordSetupNextPath rejects open redirects", () => {
    expect(safePasswordSetupNextPath(null)).toBe("/ustaw-haslo");
    expect(safePasswordSetupNextPath("//evil.com")).toBe("/ustaw-haslo");
    expect(safePasswordSetupNextPath("/ustaw-haslo?wymagane=1")).toBe(
      "/ustaw-haslo?wymagane=1"
    );
  });

  it("buildPasswordConfirmLink encodes token_hash and type", () => {
    const link = buildPasswordConfirmLink("hash123", "invite");
    const url = new URL(link);
    expect(url.pathname).toBe("/auth/confirm");
    expect(url.searchParams.get("token_hash")).toBe("hash123");
    expect(url.searchParams.get("type")).toBe("invite");
    expect(url.searchParams.get("next")).toBe("/ustaw-haslo");
  });
});
