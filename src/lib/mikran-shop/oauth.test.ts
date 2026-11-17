import { describe, expect, it } from "vitest";
import {
  MikranAuthError,
  mikranAuthorizeUrl,
  mikranOAuthCookieValue,
  parseTokenResponse,
  pkceChallenge,
  pkcePair,
  readMikranOAuthCookie,
} from "@/lib/mikran-shop/oauth";

describe("PKCE i adres logowania", () => {
  it("challenge S256 jak w RFC 7636 (przykład z dodatku B)", () => {
    expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(pkceChallenge(verifier));
  });

  it("authorize: klient ontime, zarejestrowany adres powrotu, zakres helpdesku, S256", () => {
    const url = new URL(mikranAuthorizeUrl({ state: "st", challenge: "ch" }));
    expect(url.origin + url.pathname).toBe("https://mikran.pl/api/v1/oauth/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      response_type: "code",
      client_id: "mk_f652e5ce44a93a3f88d05e32",
      scope: "helpdesk:read helpdesk:write",
      state: "st",
      code_challenge: "ch",
      code_challenge_method: "S256",
    });
    expect(url.searchParams.get("redirect_uri")).toMatch(/\/api\/mcp\/auth_callback$/);
  });
});

describe("ciasteczko startu", () => {
  const cookie = mikranOAuthCookieValue("state-1", "user-1", "verifier-1");

  it("zgodny stan i ta sama osoba → weryfikator PKCE", () => {
    expect(readMikranOAuthCookie(cookie, "state-1", "user-1")).toEqual({ ok: true, verifier: "verifier-1" });
  });

  it("inny stan, inna osoba, brak ciasteczka albo weryfikatora → odrzucone", () => {
    expect(readMikranOAuthCookie(cookie, "state-2", "user-1").ok).toBe(false);
    expect(readMikranOAuthCookie(cookie, "state-1", "user-2").ok).toBe(false);
    expect(readMikranOAuthCookie(undefined, "state-1", "user-1").ok).toBe(false);
    expect(readMikranOAuthCookie(cookie, null, "user-1").ok).toBe(false);
    expect(readMikranOAuthCookie("state-1|user-1|", "state-1", "user-1").ok).toBe(false);
  });
});

describe("odpowiedź /oauth/token", () => {
  const now = Date.UTC(2026, 10, 17, 12);

  it("tokeny, czas wygaśnięcia, zakres", () => {
    const t = parseTokenResponse(200, { access_token: "a", refresh_token: "r", expires_in: 600, scope: "helpdesk:read" }, now);
    expect(t).toEqual({ accessToken: "a", refreshToken: "r", expiresAt: new Date(now + 600_000), scope: "helpdesk:read" });
  });

  it("bez refresh_token i expires_in → null i godzina", () => {
    const t = parseTokenResponse(200, { access_token: "a" }, now);
    expect(t.refreshToken).toBeNull();
    expect(t.expiresAt).toEqual(new Date(now + 3_600_000));
  });

  it("błąd sklepu → MikranAuthError z kodem", () => {
    expect(() => parseTokenResponse(400, { error: "invalid_grant" }, now)).toThrow(MikranAuthError);
    expect(() => parseTokenResponse(400, { error: "invalid_grant" }, now)).toThrow(/400 invalid_grant/);
    expect(() => parseTokenResponse(200, null, now)).toThrow(MikranAuthError);
  });
});
