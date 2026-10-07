/**
 * Gmail użytkownika (OAuth, aplikacja „Internal” w Google Workspace Mikranu).
 * `gmail.send` — wysyłka (ląduje w „Wysłanych” nadawcy); `gmail.readonly` — odczyt maili od adresów /
 * domen z kart dostawców i zwrotów (Poczta dostawców, `supplier-mail/sync.ts`) oraz wątków wysłanych ZD.
 * Reszty skrzynki OnTime nie przegląda.
 *
 * Env: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_TOKEN_KEY
 * (32 bajty base64 — klucz AES do refresh tokenów w bazie: `openssl rand -base64 32`).
 * Przekierowanie: `${NEXT_PUBLIC_APP_URL}/api/google/callback` (musi być HTTPS).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/env/app-config";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const SCOPES = ["openid", "email", GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE];
const API_URL = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Połączenie sprzed odczytu odpowiedzi (albo bez tej zgody) — trzeba połączyć ponownie. */
export function scopeCanReadReplies(scope: string | null | undefined): boolean {
  return String(scope ?? "").split(" ").includes(GMAIL_READ_SCOPE);
}

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
/** Endpoint uploadu (message/rfc822): do 35 MB — JSON z `raw` ma dużo niższy limit, a odprawa wysyła do 18 MB załączników. */
const SEND_URL = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media";
const TIMEOUT_MS = 20_000;

export type GmailOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenKey: Buffer;
};

/** null = funkcja wyłączona (brak konfiguracji) — UI nie pokazuje „Połącz z Gmailem”. */
export function getGmailOAuthConfig(env: NodeJS.ProcessEnv = process.env): GmailOAuthConfig | null {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  const keyRaw = env.GOOGLE_OAUTH_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !keyRaw) return null;
  const tokenKey = Buffer.from(keyRaw, "base64");
  if (tokenKey.length !== 32) return null;
  return { clientId, clientSecret, redirectUri: `${getAppUrl()}/api/google/callback`, tokenKey };
}

export class GmailReconnectRequiredError extends Error {
  constructor() {
    super("Połączenie z Gmailem wygasło lub zostało cofnięte — połącz konto ponownie.");
    this.name = "GmailReconnectRequiredError";
  }
}

// ─── Szyfrowanie refresh tokenu ───────────────────────────────────────────

export function encryptToken(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptToken(key: Buffer, enc: string): string {
  const [v, iv, tag, ct] = enc.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Nieznany format zaszyfrowanego tokenu.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// ─── OAuth ────────────────────────────────────────────────────────────────

export function buildGmailAuthUrl(cfg: GmailOAuthConfig, state: string, loginHint?: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    // offline + consent: Google zawsze oddaje refresh token (także przy ponownym łączeniu).
    access_type: "offline",
    prompt: "consent",
    state,
    ...(loginHint ? { login_hint: loginHint } : {}),
  }).toString();
  return url.toString();
}

/**
 * E-mail z id_token. Token przychodzi bezpośrednio z endpointu Google po TLS,
 * więc wg OpenID Connect (3.1.3.7) wystarczy odczyt bez weryfikacji podpisu.
 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      email_verified?: unknown;
    };
    if (typeof claims.email !== "string" || claims.email_verified === false) return null;
    return claims.email.trim().toLowerCase();
  } catch {
    return null;
  }
}

async function postForm(url: string, body: Record<string, string>): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

export async function exchangeGmailCode(
  cfg: GmailOAuthConfig,
  code: string
): Promise<{ refreshToken: string; email: string; scope: string }> {
  const res = await postForm(TOKEN_URL, {
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const json = (await res.json().catch(() => ({}))) as {
    refresh_token?: string;
    id_token?: string;
    scope?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(`Google odrzucił logowanie (${json.error ?? res.status}).`);
  const email = emailFromIdToken(json.id_token);
  const scope = json.scope ?? "";
  if (!json.refresh_token || !email) throw new Error("Google nie zwrócił danych konta — spróbuj ponownie.");
  if (!scope.split(" ").includes(GMAIL_SEND_SCOPE)) {
    throw new Error("Bez zgody na wysyłanie e-maili OnTime nie może wysyłać z Gmaila. Połącz ponownie i zaznacz zgodę.");
  }
  return { refreshToken: json.refresh_token, email, scope };
}

export async function gmailAccessToken(cfg: GmailOAuthConfig, refreshToken: string): Promise<string> {
  const res = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string };
  if (json.error === "invalid_grant") throw new GmailReconnectRequiredError();
  if (!res.ok || !json.access_token) throw new Error(`Google nie wydał tokenu (${json.error ?? res.status}).`);
  return json.access_token;
}

/** Cofnięcie zgody w Google — błąd nie blokuje odłączenia w OnTime. */
export async function revokeGmailToken(token: string): Promise<void> {
  await postForm(REVOKE_URL, { token }).catch(() => undefined);
}

// ─── Wiadomość ────────────────────────────────────────────────────────────

export type GmailAttachment = { filename: string; content: Buffer; contentType?: string };

export type GmailMessageInput = {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  text: string;
  html: string;
  attachments?: GmailAttachment[];
  /** Odpowiedź: Message-ID wiadomości, na którą odpowiadamy (In-Reply-To + References). */
  inReplyTo?: string;
};

/** MIME (RFC 5322) przez nodemailer — ten sam składacz co przy SMTP, bez wysyłki. */
export async function buildMimeMessage(input: GmailMessageInput): Promise<Buffer> {
  const info = await nodemailer
    .createTransport({ streamTransport: true, buffer: true, newline: "unix" })
    .sendMail({
      from: input.from,
      to: input.to,
      cc: input.cc?.length ? input.cc : undefined,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
      ...(input.inReplyTo ? { inReplyTo: input.inReplyTo, references: [input.inReplyTo] } : {}),
    });
  return info.message as Buffer;
}

export async function sendGmailRaw(
  accessToken: string,
  mime: Buffer
): Promise<{ id: string; threadId: string | null }> {
  const res = await fetch(SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "message/rfc822" },
    body: new Uint8Array(mime),
    signal: AbortSignal.timeout(TIMEOUT_MS * 3),
  });
  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    threadId?: string;
    error?: { message?: string; status?: string };
  };
  if (res.status === 401) throw new GmailReconnectRequiredError();
  if (!res.ok || !json.id) {
    throw new Error(`Gmail nie wysłał wiadomości: ${json.error?.message ?? res.status}`);
  }
  return { id: json.id, threadId: json.threadId ?? null };
}

// ─── Odpowiedzi w wątku wysłanej wiadomości ───────────────────────────────

/**
 * Rodzaj wiadomości w wątku: odpowiedź dostawcy, autoodpowiedź (urlop, „out of office”),
 * zwrot (mail nie doszedł) albo odpowiedź kogoś z Mikranu (np. z DW). Tylko `supplier` zamyka czekanie.
 */
export type GmailReplyKind = "supplier" | "auto" | "bounce" | "internal";

export type GmailReply = {
  id: string;
  kind: GmailReplyKind;
  from: string;
  /** ISO. */
  at: string;
  snippet: string;
  attachments: string[];
  /** Pełna treść bez cytatu — tylko gdy pobrano z `withText`. */
  text?: string;
  /** Załączniki PDF do pobrania (tylko z `withText`). */
  pdfs?: GmailPdfRef[];
};

export type GmailPdfRef = { filename: string; attachmentId: string; size: number };

type GmailPart = {
  filename?: string;
  mimeType?: string;
  body?: { data?: string; attachmentId?: string; size?: number };
  parts?: GmailPart[];
};
export type GmailThreadMessage = {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart & { headers?: GmailHeaders };
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  euro: "€",
  laquo: "«",
  raquo: "»",
  bdquo: "„",
  rdquo: "”",
};

/** Encje HTML: nazwane podstawowe i numeryczne (&#39;, &#8217;, &#x2013;). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[e.toLowerCase()] ?? whole;
  });
}

type GmailHeaders = Array<{ name: string; value: string }>;

function header(headers: GmailHeaders | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

const INTERNAL_FROM_RE = /@(?:[a-z0-9-]+\.)*mikran\.(?:pl|com)\b/i;
const AUTO_SUBJECT_RE =
  /^\s*(?:automatic reply|auto(?:matic)?[- ]?(?:reply|response)|automatische antwort|out of (?:the )?office|abwesenheit|odpowied[zź] automatyczna|autoodpowied[zź]|nieobecno[sś][cć]|r[ée]ponse automatique)/i;

/** Zwrot / autoodpowiedź / ktoś z Mikranu / dostawca — po nagłówkach (RFC 3834) i temacie. */
export function classifyReply(headers: GmailHeaders | undefined): GmailReplyKind {
  const from = header(headers, "From");
  const contentType = header(headers, "Content-Type");
  if (/mailer-daemon|postmaster/i.test(from) || /report-type="?delivery-status/i.test(contentType)) return "bounce";
  const autoSubmitted = header(headers, "Auto-Submitted").trim().toLowerCase();
  if (
    (autoSubmitted && autoSubmitted !== "no") ||
    header(headers, "X-Autoreply") ||
    header(headers, "X-Autorespond") ||
    /^auto_reply$/i.test(header(headers, "Precedence").trim()) ||
    AUTO_SUBJECT_RE.test(header(headers, "Subject"))
  ) {
    return "auto";
  }
  if (INTERNAL_FROM_RE.test(from)) return "internal";
  return "supplier";
}

/** Nagłówek cytatu: „Dnia … napisał(a):”, „On … wrote:”, „Am … schrieb …:”. */
/**
 * Początek nagłówka cytatu: „Dnia …”, „On …”, „Am …”, „Le …” albo data z polskiego Gmaila
 * („śr., 7 paź 2026 o 21:19 …”), zakończone „napisał(a)” / „wrote” / „schrieb” / „a écrit”.
 */
const QUOTE_LEAD = String.raw`(?:(?:Dnia|W dniu|On|Am|Le)\s|(?:pon|wt|śr|czw|pt|sob|niedz|niedz\.)\.?,\s\d{1,2}\s\S+\s\d{4}\s)`;
const QUOTE_HEADER = new RegExp(`\\s${QUOTE_LEAD}.{0,120}?(?:napisał|wrote|schrieb|a écrit)[\\s\\S]*$`);

/** Gmail zwraca snippet z encjami HTML (&#39;, &amp;…); cytat naszej wiadomości odcinamy. */
function decodeSnippet(s: string): string {
  return decodeEntities(s).replace(QUOTE_HEADER, "").trim();
}

function attachmentNames(part: GmailPart | undefined): string[] {
  if (!part) return [];
  return [...(part.filename ? [part.filename] : []), ...(part.parts ?? []).flatMap(attachmentNames)];
}

/**
 * Odpowiedzi = wiadomości wątku po naszej wysyłce, których nie wysłaliśmy sami (bez etykiety SENT)
 * i które nie są szkicem. Najnowsze na końcu.
 */
export function repliesFromThread(
  messages: GmailThreadMessage[],
  sentMessageId: string,
  opts: { withText?: boolean } = {}
): GmailReply[] {
  const sent = messages.find((m) => m.id === sentMessageId);
  const after = Number(sent?.internalDate ?? 0);
  return messages
    .filter((m) => {
      const labels = m.labelIds ?? [];
      return m.id !== sentMessageId && !labels.includes("SENT") && !labels.includes("DRAFT");
    })
    .filter((m) => Number(m.internalDate ?? 0) > after)
    .sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0))
    .map((m) => ({
      id: m.id,
      kind: classifyReply(m.payload?.headers),
      from: header(m.payload?.headers, "From"),
      at: new Date(Number(m.internalDate ?? 0)).toISOString(),
      snippet: decodeSnippet(m.snippet ?? ""),
      attachments: attachmentNames(m.payload),
      ...(opts.withText ? { text: stripQuotedReply(messagePlainText(m.payload)), pdfs: pdfAttachmentRefs(m.payload) } : {}),
    }));
}

/** Limit Gmaila (zapytania na minutę na użytkownika) i chwilowe 5xx — ponów zamiast gubić wiadomość. */
const RETRY_DELAYS_MS = [2_000, 8_000, 20_000];

export function isGmailRetryable(status: number, message: string): boolean {
  return status === 429 || status >= 500 || (status === 403 && /quota|rate ?limit/i.test(message));
}

async function gmailGet<T>(accessToken: string, path: string): Promise<T | null> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return null;
    if (res.status === 401) throw new GmailReconnectRequiredError();
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    const delay = RETRY_DELAYS_MS[attempt];
    if (!res.ok && delay != null && isGmailRetryable(res.status, json.error?.message ?? "")) {
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return gmailResult(res, json);
  }
}

function gmailResult<T>(res: Response, json: T & { error?: { message?: string } }): T {
  // 403 „insufficient scopes” — zgoda tylko na wysyłkę; trzeba połączyć ponownie z odczytem.
  if (res.status === 403 && /scope/i.test(json.error?.message ?? "")) throw new GmailReconnectRequiredError();
  if (!res.ok) throw new Error(`Gmail nie oddał wiadomości: ${json.error?.message ?? res.status}`);
  return json;
}

/** Wątek wysłanej wiadomości i odpowiedzi w nim. null = wiadomość usunięta ze skrzynki. */
export async function fetchGmailReplies(
  accessToken: string,
  messageId: string,
  opts: { withText?: boolean } = {}
): Promise<{ threadId: string; replies: GmailReply[] } | null> {
  const msg = await gmailGet<{ threadId?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=minimal&fields=threadId`
  );
  if (!msg?.threadId) return null;
  // Z treścią: drzewo MIME do 4 poziomów (multipart/mixed → alternative → text/plain).
  const part = "filename,mimeType,body(data,attachmentId,size)";
  const fields = opts.withText
    ? `messages(id,labelIds,internalDate,snippet,payload(${part},headers,parts(${part},parts(${part},parts(${part})))))`
    : "messages(id,labelIds,internalDate,snippet,payload(filename,headers,parts(filename,parts(filename))))";
  const thread = await gmailGet<{ messages?: GmailThreadMessage[] }>(
    accessToken,
    `/threads/${encodeURIComponent(msg.threadId)}?format=full&fields=${encodeURIComponent(fields)}`
  );
  if (!thread) return null;
  return { threadId: msg.threadId, replies: repliesFromThread(thread.messages ?? [], messageId, opts) };
}

// ─── Pełna treść odpowiedzi (bez cytatu naszej wiadomości) ────────────────

const MAX_REPLY_TEXT = 6000;

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

/** Usuwa znaczniki do skutku — zagnieżdżone / sklejone („<scr<script>ipt>”) nie zostają w tekście. */
function stripTags(s: string): string {
  let prev: string;
  do {
    prev = s;
    s = s.replace(/<[^<>]*>/g, "");
  } while (s !== prev);
  return s;
}

/**
 * HTML maila → zwykły tekst (bez skryptów i stylów; akapity i <br> jako nowe linie). Wynik jest tylko
 * tekstem (React go escapuje), ale znaczniki usuwamy też po zamianie encji — „&lt;script&gt;” nie wraca.
 */
function htmlToText(html: string): string {
  let text = html;
  for (const tag of ["script", "style", "blockquote"]) text = removeElements(text, tag);
  text = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  return stripTags(decodeEntities(stripTags(text)));
}

/**
 * Wycina całe elementy `<tag …>…</tag>` (z treścią) bez wyrażeń regularnych: od otwarcia do najbliższego
 * zamknięcia. Niezamknięty element — wycina do końca tekstu (bezpieczniej niż zostawić skrypt jako tekst).
 */
function removeElements(html: string, tag: string): string {
  const lower = html.toLowerCase();
  const open = `<${tag}`;
  const close = `</${tag}`;
  let out = "";
  let pos = 0;
  for (;;) {
    let start = lower.indexOf(open, pos);
    // „<scripts>” albo „<stylex>” to nie ten element — szukamy dalej.
    while (start !== -1 && /[a-z0-9-]/.test(lower[start + open.length] ?? "")) start = lower.indexOf(open, start + 1);
    if (start === -1) return out + html.slice(pos);
    out += html.slice(pos, start);
    const end = lower.indexOf(close, start + open.length);
    if (end === -1) return out;
    const gt = lower.indexOf(">", end);
    if (gt === -1) return out;
    pos = gt + 1;
  }
}

/** Pierwszy fragment danego typu w drzewie MIME (pomija załączniki z nazwą pliku). */
function findPartData(part: GmailPart | undefined, mimeType: string): string | null {
  if (!part) return null;
  if (part.mimeType === mimeType && !part.filename && part.body?.data) return part.body.data;
  for (const child of part.parts ?? []) {
    const found = findPartData(child, mimeType);
    if (found) return found;
  }
  return null;
}

/** Treść wiadomości: text/plain, a gdy go nie ma — text/html zamieniony na tekst. */
export function messagePlainText(payload: GmailPart | undefined): string {
  const plain = findPartData(payload, "text/plain");
  if (plain) return decodeBase64Url(plain);
  const html = findPartData(payload, "text/html");
  return html ? htmlToText(decodeBase64Url(html)) : "";
}

/** Linia otwierająca cytat: „Dnia … napisał(a):”, „On … wrote:”, „Am … schrieb”, Outlook „-----Original Message-----” / „From:”. */
const QUOTE_START_LINE = new RegExp(
  `^\\s*(?:${QUOTE_LEAD}.{0,160}?(?:napisał|wrote|schrieb|a écrit)|-{2,}\\s*(?:Original Message|Oryginalna wiadomość|Ursprüngliche Nachricht|Wiadomość oryginalna)|(?:From|Od|Von|De):\\s.+)`,
  "i"
);

/** Odcina cytat naszej wiadomości i linie „> …”; zwija puste linie; limit długości. */
export function stripQuotedReply(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Nagłówek cytatu bywa złamany na dwie linie („On Tue, … Filip <f@…>” / „wrote:”).
    if (QUOTE_START_LINE.test(line) || QUOTE_START_LINE.test(`${line} ${lines[i + 1] ?? ""}`)) {
      if (out.length) break;
    }
    if (/^\s*>/.test(line)) continue;
    out.push(line);
  }
  const cleaned = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return cleaned.length > MAX_REPLY_TEXT ? `${cleaned.slice(0, MAX_REPLY_TEXT)}…` : cleaned;
}

// ─── Załączniki PDF ───────────────────────────────────────────────────────

/** Załączniki PDF w drzewie MIME (po typie albo rozszerzeniu — część klientów wysyła octet-stream). */
export function pdfAttachmentRefs(part: GmailPart | undefined): GmailPdfRef[] {
  if (!part) return [];
  const own =
    part.filename &&
    part.body?.attachmentId &&
    (part.mimeType === "application/pdf" || /\.pdf$/i.test(part.filename))
      ? [{ filename: part.filename, attachmentId: part.body.attachmentId, size: Number(part.body.size) || 0 }]
      : [];
  return [...own, ...(part.parts ?? []).flatMap(pdfAttachmentRefs)];
}

/** Treść załącznika wiadomości. null = już nie ma (wiadomość / załącznik usunięty). */
export async function fetchGmailAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer | null> {
  const json = await gmailGet<{ data?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  );
  return json?.data ? Buffer.from(json.data, "base64url") : null;
}

// ─── Poczta dostawców: wyszukiwanie, metadane, treść, odpowiedź w wątku ───

/** Id wiadomości pasujących do zapytania (najnowsze pierwsze), najwyżej `max`. */
export async function listGmailMessageIds(accessToken: string, q: string, max = 300): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailGet<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
      accessToken,
      `/messages?${params.toString()}`
    );
    for (const m of page?.messages ?? []) ids.push(m.id);
    pageToken = page?.nextPageToken;
  } while (pageToken && ids.length < max);
  return ids;
}

export type GmailAttachmentRef = { filename: string; attachmentId: string; size: number; mimeType: string };

function attachmentRefs(part: GmailPart | undefined): GmailAttachmentRef[] {
  if (!part) return [];
  const own =
    part.filename && part.body?.attachmentId
      ? [
          {
            filename: part.filename,
            attachmentId: part.body.attachmentId,
            size: Number(part.body.size) || 0,
            mimeType: part.mimeType ?? "application/octet-stream",
          },
        ]
      : [];
  return [...own, ...(part.parts ?? []).flatMap(attachmentRefs)];
}

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  labelIds: string[];
  receivedAt: string;
  snippet: string;
  kind: GmailReplyKind;
  from: string;
  /** Nagłówki To i Cc razem — czy odpowiedź poszła na zewnątrz (np. do agencji), czy wewnątrz firmy. */
  to: string;
  subject: string;
  rfcMessageId: string;
  attachments: GmailAttachmentRef[];
  /** Wysyłka masowa (List-Unsubscribe / Precedence: bulk) — newsletter, reklama. */
  bulk: boolean;
};

const META_PART = "filename,mimeType,body(attachmentId,size)";
const META_FIELDS = `id,threadId,labelIds,internalDate,snippet,payload(headers,${META_PART},parts(${META_PART},parts(${META_PART},parts(${META_PART}))))`;

/** Nagłówki, fragment i lista załączników — bez treści (szybko, mało danych). null = brak wiadomości. */
export async function getGmailMessageMeta(accessToken: string, id: string): Promise<GmailMessageMeta | null> {
  const m = await gmailGet<GmailThreadMessage & { threadId?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(id)}?format=full&fields=${encodeURIComponent(META_FIELDS)}`
  );
  if (!m?.threadId) return null;
  const headers = m.payload?.headers;
  return {
    id: m.id,
    threadId: m.threadId,
    labelIds: m.labelIds ?? [],
    receivedAt: new Date(Number(m.internalDate ?? 0)).toISOString(),
    snippet: decodeSnippet(m.snippet ?? ""),
    kind: classifyReply(headers),
    from: header(headers, "From"),
    to: [header(headers, "To"), header(headers, "Cc")].filter(Boolean).join(", "),
    subject: header(headers, "Subject"),
    rfcMessageId: header(headers, "Message-ID") || header(headers, "Message-Id"),
    attachments: attachmentRefs(m.payload),
    bulk: Boolean(header(headers, "List-Unsubscribe")) || /^(bulk|list|junk)$/i.test(header(headers, "Precedence").trim()),
  };
}

/** Wątek wiadomości (np. wysłanego ZD) — do przypinania odpowiedzi. null = wiadomości już nie ma. */
export async function getGmailThreadId(accessToken: string, messageId: string): Promise<string | null> {
  const m = await gmailGet<{ threadId?: string }>(
    accessToken,
    `/messages/${encodeURIComponent(messageId)}?format=minimal&fields=threadId`
  );
  return m?.threadId ?? null;
}

/** Pełna treść wiadomości bez cytatu (do podglądu w Poczcie dostawców). */
export async function getGmailMessageText(
  accessToken: string,
  id: string,
  /** full = z cytatem i przekazaną treścią (numer przesyłki bywa tylko w przekazanej części). */
  opts: { full?: boolean } = {}
): Promise<string | null> {
  const part = "filename,mimeType,body/data";
  const fields = `payload(${part},parts(${part},parts(${part},parts(${part}))))`;
  const m = await gmailGet<GmailThreadMessage>(
    accessToken,
    `/messages/${encodeURIComponent(id)}?format=full&fields=${encodeURIComponent(fields)}`
  );
  if (!m) return null;
  return opts.full ? messagePlainText(m.payload) : stripQuotedReply(messagePlainText(m.payload));
}

const SEND_MULTIPART_URL = "https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=multipart";

/**
 * Wysyłka w istniejącym wątku skrzynki (`threadId`) — multipart: metadane JSON + message/rfc822.
 * Nagłówki In-Reply-To / References muszą być już w MIME (inaczej Gmail nie dołączy do wątku).
 */
export async function sendGmailRawInThread(
  accessToken: string,
  mime: Buffer,
  threadId: string
): Promise<{ id: string; threadId: string | null }> {
  const boundary = `ontime-${Date.now().toString(36)}`;
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ threadId })}\r\n` +
        `--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n`
    ),
    mime,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const res = await fetch(SEND_MULTIPART_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body: new Uint8Array(body),
    signal: AbortSignal.timeout(TIMEOUT_MS * 3),
  });
  const json = (await res.json().catch(() => ({}))) as { id?: string; threadId?: string; error?: { message?: string } };
  if (res.status === 401) throw new GmailReconnectRequiredError();
  if (!res.ok || !json.id) throw new Error(`Gmail nie wysłał odpowiedzi: ${json.error?.message ?? res.status}`);
  return { id: json.id, threadId: json.threadId ?? null };
}

/** Kiedy w wątku były nasze wiadomości (etykieta SENT) — ms epoki, rosnąco. null = brak wątku. */
export async function getGmailThreadSentTimes(accessToken: string, threadId: string): Promise<number[] | null> {
  const t = await gmailGet<{ messages?: Array<{ labelIds?: string[]; internalDate?: string }> }>(
    accessToken,
    `/threads/${encodeURIComponent(threadId)}?format=minimal&fields=${encodeURIComponent("messages(labelIds,internalDate)")}`
  );
  if (!t) return null;
  return (t.messages ?? [])
    .filter((m) => m.labelIds?.includes("SENT"))
    .map((m) => Number(m.internalDate ?? 0))
    .sort((a, b) => a - b);
}
