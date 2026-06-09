import { describe, expect, it } from "vitest";
import {
  locationHadPasswordLinkTokens,
  parsePasswordLinkFromLocation,
  scrubPasswordLinkFromUrl,
} from "./establish-password-link-session";

describe("parsePasswordLinkFromLocation", () => {
  it("parses PKCE code from query", () => {
    expect(parsePasswordLinkFromLocation("?code=abc123", "")).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  it("parses token_hash OTP from query", () => {
    expect(
      parsePasswordLinkFromLocation("?token_hash=th&type=invite", "")
    ).toEqual({
      kind: "otp",
      token_hash: "th",
      type: "invite",
    });
  });

  it("parses implicit tokens from hash", () => {
    expect(
      parsePasswordLinkFromLocation(
        "",
        "#access_token=at&refresh_token=rt&type=recovery"
      )
    ).toEqual({
      kind: "hash",
      access_token: "at",
      refresh_token: "rt",
    });
  });

  it("returns none when no tokens", () => {
    expect(parsePasswordLinkFromLocation("", "")).toEqual({ kind: "none" });
  });

  it("scrubPasswordLinkFromUrl keeps wymagane param", () => {
    expect(
      scrubPasswordLinkFromUrl("/ustaw-haslo", "?wymagane=1&code=abc")
    ).toBe("/ustaw-haslo?wymagane=1");
  });

  it("locationHadPasswordLinkTokens detects hash tokens", () => {
    expect(locationHadPasswordLinkTokens("", "#access_token=a&refresh_token=b")).toBe(
      true
    );
    expect(locationHadPasswordLinkTokens("?wymagane=1", "")).toBe(false);
  });
});
