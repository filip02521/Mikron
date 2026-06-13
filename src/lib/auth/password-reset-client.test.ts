import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  requestPasswordResetCode,
  verifyPasswordResetCode,
} from "@/lib/auth/password-reset-client";

describe("password-reset-client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("wysyła accountId zamiast e-maila", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        ok: true,
        maskedEmail: "j***@firma.pl",
        resendAvailableAt: "2026-06-13T10:01:00.000Z",
      })
    );

    await requestPasswordResetCode("acc-1");

    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      accountId: "acc-1",
    });
  });

  it("zwraca czytelny błąd przy pustej odpowiedzi serwera", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("", { status: 500, headers: { "Content-Type": "application/json" } })
    );

    const result = await requestPasswordResetCode("acc-1");
    expect(result).toEqual({
      ok: false,
      error: "Serwer resetu hasła jest chwilowo niedostępny. Spróbuj ponownie.",
    });
  });

  it("weryfikuje kod z accountId", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ok: true, redirectTo: "/ustaw-haslo?reset=otp" })
    );

    const result = await verifyPasswordResetCode("acc-1", "123456");
    expect(result.ok).toBe(true);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body))).toEqual({
      accountId: "acc-1",
      code: "123456",
    });
  });
});
