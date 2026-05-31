import { afterEach, describe, expect, it } from "vitest";
import {
  loginServerResponseErrorMessage,
  loginSessionLostMessage,
} from "@/lib/auth/login-messages";

describe("login-messages", () => {
  const env = process.env;

  afterEach(() => {
    process.env = { ...env };
  });

  it("production — bez wskazówek dev", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;
    expect(loginSessionLostMessage()).not.toMatch(/\.env|Supabase|192\.168|URL Configuration/i);
    expect(loginServerResponseErrorMessage()).not.toMatch(/\.env|NEXT_PUBLIC|192\.168/i);
    expect(loginSessionLostMessage()).toContain("Zaloguj się ponownie");
  });

  it("development — podpowiedzi LAN", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_APP_URL = "http://192.168.68.51:3000";
    expect(loginSessionLostMessage()).toContain("192.168.68.51:3000");
    expect(loginSessionLostMessage()).toContain("Supabase");
  });
});
