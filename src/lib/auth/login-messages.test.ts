import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loginJsRequiredMessage,
  loginServerResponseErrorMessage,
  loginSessionLostMessage,
} from "@/lib/auth/login-messages";

describe("login-messages", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("production — bez wskazówek dev", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "");
    expect(loginSessionLostMessage()).not.toMatch(/\.env|Supabase|192\.168|URL Configuration/i);
    expect(loginServerResponseErrorMessage()).not.toMatch(/\.env|NEXT_PUBLIC|192\.168/i);
    expect(loginSessionLostMessage()).toContain("Zaloguj się ponownie");
  });

  it("development — podpowiedzi LAN", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://192.168.68.51:3000");
    expect(loginSessionLostMessage()).toContain("192.168.68.51:3000");
    expect(loginSessionLostMessage()).toContain("Supabase");
  });

  it("komunikat gdy brak JavaScript", () => {
    expect(loginJsRequiredMessage()).toContain("JavaScript");
  });
});
