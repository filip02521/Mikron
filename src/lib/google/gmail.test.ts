import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  GMAIL_READ_SCOPE,
  GMAIL_SEND_SCOPE,
  buildGmailAuthUrl,
  buildMimeMessage,
  classifyReply,
  decryptToken,
  emailFromIdToken,
  encryptToken,
  getGmailOAuthConfig,
  messagePlainText,
  pdfAttachmentRefs,
  repliesFromThread,
  scopeCanReadReplies,
  stripQuotedReply,
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
  it("URL zgody: wysyłka + odczyt, offline + consent, stan i podpowiedź konta", () => {
    const url = new URL(buildGmailAuthUrl(cfg, "st4te", "filip.naskret@mikran.com"));
    expect(url.searchParams.get("scope")).toBe(`openid email ${GMAIL_SEND_SCOPE} ${GMAIL_READ_SCOPE}`);
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

describe("gmail — odpowiedzi w wątku", () => {
  const msg = (id: string, at: number, labels: string[], from = "", extra: object = {}) => ({
    id,
    internalDate: String(at),
    labelIds: labels,
    snippet: "",
    payload: { headers: [{ name: "From", value: from }] },
    ...extra,
  });

  it("tylko cudze wiadomości po naszej wysyłce; bez szkiców i naszych dopisków; encje i załączniki", () => {
    const replies = repliesFromThread(
      [
        msg("old", 500, ["INBOX"], "x@renfert.de"),
        msg("sent", 1000, ["SENT"], "filip@mikran.com"),
        msg("ours", 3000, ["SENT"], "filip@mikran.com"),
        msg("draft", 3500, ["DRAFT"], "filip@mikran.com"),
        msg("r2", 4000, ["INBOX"], "Miriam <m@renfert.de>", { snippet: "Thanks &amp; regards" }),
        msg("r1", 2000, ["INBOX", "UNREAD"], "m@renfert.de", {
          snippet: "We&#39;ll ship on Monday",
          payload: {
            headers: [{ name: "from", value: "m@renfert.de" }],
            parts: [{ filename: "" }, { filename: "AB-123.pdf" }, { parts: [{ filename: "logo.png" }] }],
          },
        }),
      ],
      "sent"
    );
    expect(replies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(replies[0]).toMatchObject({
      from: "m@renfert.de",
      snippet: "We'll ship on Monday",
      attachments: ["AB-123.pdf", "logo.png"],
      at: new Date(2000).toISOString(),
    });
    expect(replies[1].snippet).toBe("Thanks & regards");
  });

  it("snippet bez cytatu naszej wiadomości (PL / EN / DE)", () => {
    const one = (snippet: string) => repliesFromThread([msg("sent", 1, ["SENT"]), msg("r", 2, ["INBOX"], "", { snippet })], "sent")[0].snippet;
    expect(one("Potwierdzam. Dnia 07 października 2026 19:14 Jan Nowak &lt; jan@mikran.com &gt; napisał(a): Pozdrawiam")).toBe("Potwierdzam.");
    expect(one("Confirmed, ships Monday. On Tue, 7 Oct 2026 at 19:14 Filip &lt;f@mikran.com&gt; wrote: Dear")).toBe("Confirmed, ships Monday.");
    expect(one("Danke! Am 07.10.2026 um 19:14 schrieb Filip: Dear")).toBe("Danke!");
    expect(one("On stock next week")).toBe("On stock next week");
  });

  it("zgoda na odczyt tylko z gmail.readonly", () => {
    expect(scopeCanReadReplies(`openid ${GMAIL_SEND_SCOPE} ${GMAIL_READ_SCOPE}`)).toBe(true);
    expect(scopeCanReadReplies(GMAIL_SEND_SCOPE)).toBe(false);
    expect(scopeCanReadReplies(null)).toBe(false);
  });
});

describe("gmail — pełna treść odpowiedzi", () => {
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");

  it("text/plain z multipart; bez niego — HTML jako tekst; załącznik tekstowy pomijany", () => {
    expect(
      messagePlainText({
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", filename: "notatka.txt", body: { data: b64("załącznik") } },
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: b64("Cena 120 EUR netto") } },
              { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
            ],
          },
        ],
      })
    ).toBe("Cena 120 EUR netto");
    expect(
      messagePlainText({ mimeType: "text/html", body: { data: b64("<p>Dostępne &amp; gotowe</p><br>Pozdr.<style>x{}</style>") } })
    ).toBe("Dostępne & gotowe\n\nPozdr.");
    expect(messagePlainText(undefined)).toBe("");
  });

  it("odcina cytat (PL, EN złamany na 2 linie, Outlook) i linie z >", () => {
    expect(stripQuotedReply("Cena 120 zł netto.\nDostępne od ręki.\n\nDnia 7 października 2026 Filip <f@mikran.com> napisał(a):\nHello")).toBe(
      "Cena 120 zł netto.\nDostępne od ręki."
    );
    expect(stripQuotedReply("Lead time 5 days.\r\n\r\nOn Tue, 7 Oct 2026 at 19:14 Jan Nowak <j@mikran.com>\r\nwrote:\r\n> Hello")).toBe(
      "Lead time 5 days."
    );
    expect(stripQuotedReply("Ja.\n\n-----Original Message-----\nFrom: Filip")).toBe("Ja.");
    // Polski Gmail: „śr., 7 paź 2026 o 21:19 Filip <…> napisał(a):”
    expect(stripQuotedReply("Tak, dostępny.\n\nśr., 7 paź 2026 o 21:19 <jan.nowak@mikran.com> napisał(a):\n\n> Hello")).toBe("Tak, dostępny.");
    expect(stripQuotedReply("Hi,\n> quoted\nYes, in stock.")).toBe("Hi,\nYes, in stock.");
    // Nagłówek „From:” na samym początku (bez treści przed) nie zjada całej wiadomości.
    expect(stripQuotedReply("From: sklep\nCena 10 zł")).toBe("From: sklep\nCena 10 zł");
  });
});

describe("gmail — załączniki PDF", () => {
  it("PDF po typie lub rozszerzeniu, w zagnieżdżeniu; bez treści maila i innych plików", () => {
    expect(
      pdfAttachmentRefs({
        mimeType: "multipart/mixed",
        parts: [
          { mimeType: "text/plain", body: { data: "eA" } },
          { mimeType: "application/pdf", filename: "oferta.pdf", body: { attachmentId: "a1", size: 1200 } },
          { mimeType: "application/octet-stream", filename: "FAKTURA.PDF", body: { attachmentId: "a2" } },
          { mimeType: "image/png", filename: "logo.png", body: { attachmentId: "a3", size: 10 } },
          { mimeType: "multipart/related", parts: [{ mimeType: "application/pdf", filename: "wz.pdf", body: { attachmentId: "a4", size: 5 } }] },
          { mimeType: "application/pdf", filename: "bez-id.pdf", body: {} },
        ],
      })
    ).toEqual([
      { filename: "oferta.pdf", attachmentId: "a1", size: 1200 },
      { filename: "FAKTURA.PDF", attachmentId: "a2", size: 0 },
      { filename: "wz.pdf", attachmentId: "a4", size: 5 },
    ]);
    expect(pdfAttachmentRefs(undefined)).toEqual([]);
  });
});

describe("gmail — rodzaj odpowiedzi", () => {
  const h = (pairs: Record<string, string>) => Object.entries(pairs).map(([name, value]) => ({ name, value }));

  it("dostawca, Mikran z DW, autoodpowiedź (nagłówki i temat), zwrot", () => {
    expect(classifyReply(h({ From: "Miriam <m@renfert.de>", Subject: "Re: New order" }))).toBe("supplier");
    expect(classifyReply(h({ From: "Ola <ola.wrobel@mikran.com>" }))).toBe("internal");
    expect(classifyReply(h({ From: "x@sklep.mikran.pl" }))).toBe("internal");
    expect(classifyReply(h({ From: "m@renfert.de", "Auto-Submitted": "auto-replied" }))).toBe("auto");
    expect(classifyReply(h({ From: "m@renfert.de", "Auto-Submitted": "no" }))).toBe("supplier");
    expect(classifyReply(h({ From: "m@renfert.de", "X-Autoreply": "yes" }))).toBe("auto");
    expect(classifyReply(h({ From: "m@renfert.de", Subject: "Automatische Antwort: New order" }))).toBe("auto");
    expect(classifyReply(h({ From: "m@dfs.de", Subject: "Out of Office: Product inquiry" }))).toBe("auto");
    expect(classifyReply(h({ From: "a@b.pl", Subject: "Odpowiedź automatyczna: Zapytanie" }))).toBe("auto");
    expect(classifyReply(h({ From: "Mail Delivery Subsystem <mailer-daemon@googlemail.com>" }))).toBe("bounce");
    expect(
      classifyReply(h({ From: "postmaster@dfs.de", "Content-Type": 'multipart/report; report-type="delivery-status"' }))
    ).toBe("bounce");
    expect(classifyReply(undefined)).toBe("supplier");
  });

  it("snippet: encje numeryczne i nazwane", () => {
    const [r] = repliesFromThread(
      [
        { id: "s", internalDate: "1", labelIds: ["SENT"] },
        { id: "r", internalDate: "2", labelIds: ["INBOX"], snippet: "We&#8217;ll ship &ndash; 5 days &amp; more &#x2013; ok" },
      ],
      "s"
    );
    expect(r.snippet).toBe("We’ll ship – 5 days & more – ok");
    expect(r.kind).toBe("supplier");
  });
});

describe("gmail — odpowiedź w wątku", () => {
  it("MIME odpowiedzi ma In-Reply-To i References", async () => {
    const mime = (
      await buildMimeMessage({
        from: "filip@mikran.com",
        to: ["m@renfert.de"],
        subject: "Re: New order",
        text: "Thanks",
        html: "<p>Thanks</p>",
        inReplyTo: "<abc123@renfert.de>",
      })
    ).toString("utf8");
    expect(mime).toMatch(/^In-Reply-To: <abc123@renfert\.de>$/m);
    expect(mime).toMatch(/^References: <abc123@renfert\.de>$/m);
  });
});

describe("gmail — cytat polskiego Gmaila we fragmencie", () => {
  it("odcina „śr., 7 paź 2026 o 21:19 <…> napisał(a): …”", () => {
    const [r] = repliesFromThread(
      [
        { id: "s", internalDate: "1", labelIds: ["SENT"] },
        {
          id: "r",
          internalDate: "2",
          labelIds: ["INBOX"],
          snippet: "Tak jest dostepny od reki cena netto 599 zł śr., 7 paź 2026 o 21:19 &lt;jan.nowak@mikran.com&gt; napisał(a): Hello",
        },
      ],
      "s"
    );
    expect(r.snippet).toBe("Tak jest dostepny od reki cena netto 599 zł");
  });
});
