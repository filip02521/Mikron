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

  it("zwraca czytelny błąd przy pustej odpowiedzi serwera", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("", { status: 500, headers: { "Content-Type": "application/json" } })
    );

    const result = await requestPasswordResetCode("jan@firma.pl");
    expect(result).toEqual({
      ok: false,
      error: "Serwer resetu hasła jest chwilowo niedostępny. Spróbuj ponownie.",
    });
  });

  it("parsuje poprawną odpowiedź send", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        ok: true,
        maskedEmail: "j***@firma.pl",
        resendAvailableAt: "2026-06-13T10:01:00.000Z",
      })
    );

    const result = await requestPasswordResetCode("jan@firma.pl");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.maskedEmail).toBe("j***@firma.pl");
    }
  });

  it("zwraca błąd sieci przy fetch exception", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network"));

    const result = await verifyPasswordResetCode("jan@firma.pl", "123456");
    expect(result).toEqual({
      ok: false,
      error: "Brak połączenia z serwerem. Sprawdź sieć i spróbuj ponownie.",
    });
  });
});
