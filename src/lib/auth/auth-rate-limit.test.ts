import { describe, expect, it } from "vitest";
import { authRateLimitBucket } from "@/lib/auth/auth-rate-limit";

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
