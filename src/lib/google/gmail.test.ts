import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GMAIL_SEND_SCOPE,
  buildGmailAuthUrl,
  buildMimeMessage,
  decryptToken,
  emailFromIdToken,
  encryptToken,
  getGmailOAuthConfig,
  type GmailOAuthConfig,
} from "@/lib/google/gmail";
import { readGmailOAuthCookie, safeReturnPath } from "@/lib/google/gmail-oauth-cookie";

const key = randomBytes(32);
const cfg: GmailOAuthConfig = {
  clientId: "cid.apps.googleusercontent.com",
  clientSecret: "secret",
  redirectUri: "https://ontime.mikran.pl/api/google/callback",
  tokenKey: key,
};

function idToken(claims: object): string {
  return `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
}

describe("gmail — token", () => {
  it("szyfrowanie: zapis ≠ token, odczyt wraca token; obcy klucz nie odszyfruje", () => {
    const enc = encryptToken(key, "1//refresh-token");
    expect(enc).not.toContain("refresh");
    expect(decryptToken(key, enc)).toBe("1//refresh-token");
    expect(() => decryptToken(randomBytes(32), enc)).toThrow();
  });

  it("konfiguracja: bez klucza 32 B funkcja wyłączona", () => {
    const env = { GOOGLE_OAUTH_CLIENT_ID: "a", GOOGLE_OAUTH_CLIENT_SECRET: "b" } as unknown as NodeJS.ProcessEnv;
    expect(getGmailOAuthConfig(env)).toBeNull();
    expect(getGmailOAuthConfig({ ...env, GOOGLE_OAUTH_TOKEN_KEY: "krótki" })).toBeNull();
    expect(getGmailOAuthConfig({ ...env, GOOGLE_OAUTH_TOKEN_KEY: key.toString("base64") })).not.toBeNull();
  });
});

describe("gmail — OAuth", () => {
  it("URL zgody: tylko wysyłka, offline + consent, stan i podpowiedź konta", () => {
    const url = new URL(buildGmailAuthUrl(cfg, "st4te", "filip.naskret@mikran.com"));
    expect(url.searchParams.get("scope")).toBe(`openid email ${GMAIL_SEND_SCOPE}`);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("st4te");
    expect(url.searchParams.get("login_hint")).toBe("filip.naskret@mikran.com");
    expect(url.searchParams.get("redirect_uri")).toBe(cfg.redirectUri);
  });

  it("e-mail z id_token (małe litery); niezweryfikowany albo śmieci → null", () => {
    expect(emailFromIdToken(idToken({ email: "Filip.Naskret@mikran.com", email_verified: true }))).toBe(
      "filip.naskret@mikran.com"
    );
    expect(emailFromIdToken(idToken({ email: "x@mikran.com", email_verified: false }))).toBeNull();
    expect(emailFromIdToken("nie-jwt")).toBeNull();
    expect(emailFromIdToken(undefined)).toBeNull();
  });

  it("powrót tylko na ścieżkę OnTime", () => {
    expect(safeReturnPath("/zakupy/szacunek")).toBe("/zakupy/szacunek");
    expect(safeReturnPath("//evil.com")).toBe("/");
    expect(safeReturnPath("https://evil.com")).toBe("/");
    expect(safeReturnPath("/\\evil.com")).toBe("/");
    expect(safeReturnPath(null)).toBe("/");
  });

  it("ciasteczko stanu: zgodny stan → returnTo; inny stan lub brak → odrzuć", () => {
    expect(readGmailOAuthCookie("abc|/zakupy/szacunek", "abc")).toEqual({ ok: true, returnTo: "/zakupy/szacunek" });
    expect(readGmailOAuthCookie("abc|/x", "xyz")).toEqual({ ok: false });
    expect(readGmailOAuthCookie(undefined, "abc")).toEqual({ ok: false });
    expect(readGmailOAuthCookie("abc|//evil.com", "abc")).toEqual({ ok: true, returnTo: "/" });
  });
});

describe("gmail — MIME", () => {
  it("wiadomość z polskim tematem i załącznikiem", async () => {
    const mime = (
      await buildMimeMessage({
        from: "filip.naskret@mikran.com",
        to: ["order@renfert.de"],
        subject: "Zamówienie ZD 123/26 — Łódź",
        text: "Dzień dobry",
        html: "<p>Dzień dobry</p>",
        attachments: [{ filename: "Zamowienie ZD 123_26.pdf", content: Buffer.from("%PDF-1.7"), contentType: "application/pdf" }],
      })
    ).toString();
    expect(mime).toContain("From: filip.naskret@mikran.com");
    expect(mime).toContain("To: order@renfert.de");
    expect(mime).toMatch(/Subject: =\?UTF-8\?/);
    expect(mime).toContain("multipart/mixed");
    expect(mime).toContain("Zamowienie ZD 123_26.pdf");
  });
});
