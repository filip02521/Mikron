import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { runLoginFlow } from "@/lib/auth/login-flow";

describe("runLoginFlow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loguje przez accountId gdy API zwraca redirect", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/podsumowanie", accountId: "user-1" })
    );

    const result = await runLoginFlow({
      accountId: "acc-1",
      password: "secret",
      next: null,
    });

    expect(result).toEqual({ ok: true, redirectTo: "/podsumowanie", accountId: "user-1" });
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toMatchObject({
      accountId: "acc-1",
    });
  });

  it("zwraca błąd z API bez fallbacku klienta", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: false, error: "Nieprawidłowe dane." }, { status: 401 })
    );

    const result = await runLoginFlow({
      email: "jan@firma.pl",
      password: "secret",
      next: null,
    });

    expect(result).toEqual({ ok: false, error: "Nieprawidłowe dane." });
  });
});
