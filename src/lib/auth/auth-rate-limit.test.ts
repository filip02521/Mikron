import { describe, expect, it } from "vitest";
import {
  authRateLimitBucket,
  authRateLimitHttpResponse,
} from "@/lib/auth/auth-rate-limit";

describe("authRateLimitBucket", () => {
  it("normalizuje część bucketu do małych liter", () => {
    expect(authRateLimitBucket("login:email", "User@Example.COM")).toBe(
      "login:email:user@example.com"
    );
  });

  it("obcina spacje w części bucketu", () => {
    expect(authRateLimitBucket("login:ip", "  192.168.0.1  ")).toBe(
      "login:ip:192.168.0.1"
    );
  });
});

describe("authRateLimitHttpResponse", () => {
  it("zwraca 429 przy przekroczonym limicie", () => {
    expect(authRateLimitHttpResponse({ ok: false, retryAfterSec: 120 })).toEqual({
      error: "Zbyt wiele prób logowania. Spróbuj ponownie za chwilę.",
      status: 429,
    });
  });

  it("zwraca 503 gdy limit niedostępny", () => {
    expect(
      authRateLimitHttpResponse({ ok: false, retryAfterSec: 60, unavailable: true })
    ).toEqual({
      error: "Chwilowo nie można zweryfikować limitu prób. Spróbuj za chwilę.",
      status: 503,
    });
  });
});
