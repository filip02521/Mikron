import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  LOGIN_PASSWORD_RESET_STORAGE_KEY,
  readStoredPasswordResetSession,
  writeStoredPasswordResetSession,
} from "@/lib/auth/login-password-reset-session";

describe("login password reset session storage", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem(key: string) {
          return store[key] ?? null;
        },
        setItem(key: string, value: string) {
          store[key] = value;
        },
        removeItem(key: string) {
          delete store[key];
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("zapisuje i odczytuje aktywną sesję resetu", () => {
    writeStoredPasswordResetSession({
      email: "jan@firma.pl",
      maskedEmail: "j***@firma.pl",
      resendAvailableAt: new Date(Date.now() + 60_000).toISOString(),
      startedAt: new Date().toISOString(),
    });

    const stored = readStoredPasswordResetSession();
    expect(stored?.email).toBe("jan@firma.pl");
  });

  it("czyści wygasłą sesję resetu", () => {
    writeStoredPasswordResetSession({
      email: "jan@firma.pl",
      maskedEmail: "j***@firma.pl",
      resendAvailableAt: new Date().toISOString(),
      startedAt: new Date(Date.now() - 11 * 60_000).toISOString(),
    });

    expect(readStoredPasswordResetSession()).toBeNull();
    expect(window.sessionStorage.getItem(LOGIN_PASSWORD_RESET_STORAGE_KEY)).toBeNull();
  });
});
