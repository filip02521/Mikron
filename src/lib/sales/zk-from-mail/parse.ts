/**
 * Wklejony mail klienta → nadawca, NIP i linie z towarami (czysta logika, serwer i klient).
 * Dopasowanie do Subiekta robi `match.ts`; tutaj tylko czytamy tekst.
 */

export type ParsedMailLine = {
  /** Linia z maila po zdjęciu punktora — pokazywana handlowcowi jako cytat. */
  text: string;
  /** null = w mailu nie ma ilości (pole zostaje puste, nie zgadujemy). */
  quantity: number | null;
  /** Tokeny wyglądające na symbol towaru (z cyfrą), w kolejności z maila. */
  symbols: string[];
  /** Rdzenie słów do wyszukiwania po nazwie (bez ilości, jednostek i słów grzecznościowych). */
  nameStems: string[];
  /** Krótkie kody z literą i cyfrą („4B”, „A33”) — tylko do kolejności podpowiedzi, nie do zapytania. */
  hints: string[];
};

export type ParsedMail = {
  /** Nadawca spoza firmy: w przekazanym mailu nadawca najgłębszej wiadomości, inaczej pierwszy adres z Od:/From: albo z treści. */
  senderEmail: string | null;
  /** W mailu są tylko adresy Mikranu (np. przekazany bez nagłówka klienta). */
  onlyOwnSender: boolean;
  /** NIP z treści (10 cyfr), gdy jest. */
  nip: string | null;
  lines: ParsedMailLine[];
};

/** Domeny firmy — adres handlowca w przekazanym mailu to nie klient. */
const OWN_DOMAINS = ["mikran.pl", "mikran.com"];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const HAS_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/** Nagłówek wiadomości — tylko z dwukropkiem („Do tego 2 szt.” to treść, nie nagłówek). */
const HEADER_RE = /^(od|from|do|to|dw|cc|temat|subject|data|date|wysłano|sent|adres|adres dostawy)\s*:/i;
/** Dane firmy w stopce — numer bez dwukropka („NIP 7831728392”) wyglądałby na symbol. */
const COMPANY_LINE_RE = /^(nip|regon|krs|bdo|ul\.|tel\b|tel\.|telefon|kom\.|kom\b|mob\.|fax)/i;
/** Koniec treści zamówienia: podpis, cytat poprzedniej wiadomości. */
const STOP_RE = /^(--\s*$|_{3,}\s*$|pozdrawiam|z powa[żz]aniem|dzi[ęe]kuj[ęe]|dziekuje|best regards|regards|w dniu .* napisa[łl]|on .* wrote|-{2,}\s*(original|oryginalna))|napisa[łl](\(a\))?:\s*$|wrote:\s*$/i;
/** Granica cytowanej poprzedniej wiadomości (odpowiedź) — dalej nie szukamy NIP-u klienta. */
const REPLY_BOUNDARY_RE = /^(-{2,}\s*(original message|oryginalna wiadomo[śs][ćc])|w dniu .* napisa[łl]|on .* wrote)|napisa[łl](\(a\))?:\s*$|wrote:\s*$/i;
/** Początek przekazanej wiadomości (Gmail, Outlook, Thunderbird). */
const FORWARD_RE = /^-{2,}\s*(forwarded message|wiadomo[śs][ćc] przekazana dalej)|^(pocz[ąa]tek przekazywanej wiadomo[śs]ci|begin forwarded message)\s*:?|^(fwd|pd|fw):/i;
const FROM_HEADER_RE = /^\s*\**(od|from)\**\s*:/i;

const UNIT = String.raw`(?:szt|sztuk|sztuki|sztuka|op|opak|opakowa[nń]|opakowania|opakowanie|kpl|kompl|komplet|komplety|pcs|pc|pak|paczk[aię]|kart|karton|kartony|x|×)\.?`;
const QTY_BEFORE_UNIT_RE = new RegExp(String.raw`(?:^|[\s(:–-])(\d{1,4}(?:[.,]\d{1,2})?)\s*${UNIT}(?=$|[\s,.;)])`, "i");
const QTY_AFTER_X_RE = /(?:^|\s)(?:x|×|ilo[śs][ćc]\s*:?|qty\s*:?)\s*(\d{1,4}(?:[.,]\d{1,2})?)(?=$|[\s,.;)])/i;
/** „gips – 4” (myślnik po spacji — nie „AB-1234”). */
const QTY_TRAILING_DASH_RE = /\s[–:=-]\s*(\d{1,4})\s*$/;

const STOPWORDS = new Set(
  [
    "proszę", "prosze", "poproszę", "poprosze", "prosimy", "zamawiam", "zamawiamy", "zamówienie", "zamowienie",
    "zamówić", "zamowic", "potrzebuję", "potrzebuje", "potrzebujemy", "chcę", "chce", "chcemy", "dzień", "dzien",
    "dobry", "witam", "tego", "samego", "samo", "same", "taki", "taka", "takie", "jak", "ostatnio", "poprzednio",
    "dla", "nas", "mnie", "chciałabym", "chciałbym", "chcielibyśmy", "chciałam", "zamawialiśmy", "zgodnie", "państwa", "ofertą", "niniejszym", "cenie", "cena", "netto", "brutto", "oraz", "również", "rowniez", "też", "tez", "jeszcze", "który", "ktory", "która", "ktora",
    "które", "ktore", "sztuk", "sztuki", "sztuka", "opakowanie", "opakowania", "opakowań", "opak", "komplet",
    "rozmiar", "rozm", "kolor", "zęby", "zębów", "ząb", "produkt", "produkty", "produktów", "towar", "towary", "towarów", "firmy", "poniższe", "poniższych", "następujące", "następujących", "pilne", "pilnie", "the", "and", "please", "order",
  ].map((w) => w.toLowerCase())
);

function cleanLine(raw: string): string {
  return raw
    .replace(/\u00a0/g, " ")
    .replace(/^\s*(?:[-*•·–]|\d{1,2}[.)])\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(raw: string): number | null {
  const n = Number(raw.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ilość i fragment linii, który ją zawierał (żeby nie wziąć liczby ilości za symbol). */
export function extractQuantity(line: string): { quantity: number | null; span: string | null } {
  for (const re of [QTY_AFTER_X_RE, QTY_BEFORE_UNIT_RE, QTY_TRAILING_DASH_RE]) {
    const m = line.match(re);
    if (m?.[1]) return { quantity: toNumber(m[1]), span: m[0] };
  }
  return { quantity: null, span: null };
}

/** Symbol: ma cyfrę i ≥5 znaków, albo litery z cyframi od 4 znaków („WD-K012”, „517019”), nie rozmiar „012”. */
export function looksLikeSymbol(token: string): boolean {
  if (!/\d/.test(token)) return false;
  if (!/^[\p{L}\d][\p{L}\d./-]*[\p{L}\d]$/u.test(token)) return false;
  if (/^\d+[.,]\d+$/.test(token)) return false;
  // Kod pocztowy, numer dokumentu („2859/M/05/2025”), data.
  if (/^\d{2}-\d{3}$/.test(token) || /^\d+\/.*\/(19|20)\d{2}$/.test(token) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(token)) return false;
  const hasLetter = /\p{L}/u.test(token);
  return token.length >= 5 || (hasLetter && token.length >= 4);
}

/** Rdzeń słowa do wyszukiwania podciągiem (odmiana: „kompozytu” → „kompoz”). */
export function wordStem(word: string): string {
  const w = word.toLowerCase();
  if (w.length <= 5) return w;
  return w.slice(0, Math.max(5, Math.min(6, w.length - 2)));
}

function isOwnEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return OWN_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

function findSenderEmail(lines: string[]): string | null {
  const headerFirst = [...lines.filter((l) => /^\s*(od|from)\s*:/i.test(l)), ...lines];
  for (const l of headerFirst) {
    for (const m of l.match(EMAIL_RE) ?? []) {
      const email = m.toLowerCase().replace(/\.$/, "");
      if (!isOwnEmail(email)) return email;
    }
  }
  return null;
}

function findNip(text: string): string | null {
  const m = text.match(/NIP\s*:?\s*(?:PL)?\s*((?:\d[\s-]?){10})/i);
  const digits = m?.[1]?.replace(/\D/g, "") ?? "";
  return digits.length === 10 ? digits : null;
}

function isPhoneLike(line: string): boolean {
  return /(?:\+?\d[\s-]?){9,}/.test(line) && !/\p{L}{4,}/u.test(line.replace(/tel\.?|mob\.?|kom\.?/gi, ""));
}

function tokensOf(text: string): string[] {
  return text.split(/[\s,;()]+/).map((t) => t.replace(/^[.:*]+|[.:*]+$/g, "")).filter(Boolean);
}

/** Słowa z nazwy (bez słów grzecznościowych) jako rdzenie do wyszukiwania. */
function wordStems(tokens: string[]): string[] {
  return tokens.filter((t) => /^\p{L}{3,}$/u.test(t) && !STOPWORDS.has(t.toLowerCase())).map(wordStem);
}

/** Wstęp listy („Chciałabym zamówić zęby z Majora Super Lux:”) — dopowiada nazwę liniom pod nim. */
export function introContextStems(line: string): string[] {
  return /:\s*$/.test(line) ? wordStems(tokensOf(line)) : [];
}

export function parseMailLine(text: string, contextStems: string[] = []): ParsedMailLine | null {
  const { quantity, span } = extractQuantity(text);
  const rest = span ? text.replace(span, " ") : text;
  const tokens = tokensOf(rest);
  const symbols = [...new Set(tokens.filter(looksLikeSymbol))].slice(0, 3);
  // Krótki kod z literą i cyframi („A33”) — rozmiar w nazwie towaru; za krótki na symbol.
  const codes = tokens.filter((t) => /^(?=.*\p{L})(?=.*\d)[\p{L}\d]{3}$/u.test(t)).map((t) => t.toLowerCase());
  const ownStems = wordStems(tokens.filter((t) => !symbols.includes(t)));
  const nameStems = [...new Set([...codes, ...contextStems, ...ownStems])].slice(0, 4);
  const hints = [...new Set(tokens.filter((t) => /^(?=.*\p{L})(?=.*\d)[\p{L}\d]{2,3}$/u.test(t)).map((t) => t.toLowerCase()))];
  if (quantity == null && symbols.length === 0) return null;
  if (symbols.length === 0 && codes.length === 0 && ownStems.length === 0) return null;
  return { text, quantity, symbols, nameStems, hints };
}

function emailsIn(line: string): string[] {
  return (line.match(EMAIL_RE) ?? []).map((m) => m.toLowerCase().replace(/\.$/, ""));
}

/**
 * Przekazany mail: klient to nadawca ostatniej (najgłębszej) przekazanej wiadomości, a zamówienie leży pod jej
 * nagłówkiem — nie notatka kolegi nad nim ani odpowiedź dostawcy w środku łańcucha.
 */
function forwardedStart(lines: string[]): { sender: string | null; start: number } | null {
  const markers = lines.flatMap((l, i) => (FORWARD_RE.test(l.trim()) ? [i] : []));
  // Od najgłębszego: przekazana dalej nasza własna wiadomość (np. oferta handlowca) nie jest zamówieniem klienta.
  for (const marker of markers.reverse()) {
    const fromIdx = lines.findIndex((l, i) => i > marker && FROM_HEADER_RE.test(l));
    if (fromIdx < 0) continue;
    const sender = emailsIn(lines[fromIdx]!).find((e) => !isOwnEmail(e));
    if (sender) return { sender, start: fromIdx + 1 };
  }
  return null;
}

/** Wiadomość klienta: od jej początku do cytatu poprzedniej wiadomości (tam bywa nasza stopka z naszym NIP-em). */
function clientMessageText(lines: string[], start: number): string {
  const end = lines.findIndex((l, i) => i >= start && (REPLY_BOUNDARY_RE.test(l.trim()) || (i > start && FORWARD_RE.test(l.trim()))));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

/** Czyta wklejony mail. Linia z towarem = ma ilość albo symbol; nagłówki, podpis i cytat poprzedniej wiadomości pomijamy. */
export function parseCustomerMail(raw: string): ParsedMail {
  // Cytat „> ” zdejmujemy, nie pomijamy: w przekazanym mailu zamówienie klienta bywa całe w cytacie.
  const rawLines = String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/^(\s*>)+\s?/, ""));
  const forwarded = forwardedStart(rawLines);
  const senderEmail = forwarded?.sender ?? findSenderEmail(rawLines);
  const nip = findNip(clientMessageText(rawLines, forwarded?.start ?? 0));
  const lines: ParsedMailLine[] = [];
  let bodyStarted = false;
  let context: string[] = [];
  for (const rawLine of rawLines.slice(forwarded?.start ?? 0)) {
    const line = cleanLine(rawLine);
    if (!line) continue;
    if (HEADER_RE.test(line) || COMPANY_LINE_RE.test(line)) continue;
    if (STOP_RE.test(line)) {
      if (bodyStarted) break;
      continue;
    }
    if (HAS_EMAIL_RE.test(line) || /https?:\/\//i.test(line) || isPhoneLike(line)) continue;
    const parsed = parseMailLine(line, context);
    if (parsed) {
      lines.push(parsed);
      bodyStarted = true;
    } else if (/:\s*$/.test(line)) {
      context = introContextStems(line);
    }
  }
  const onlyOwnSender = !senderEmail && rawLines.some((l) => emailsIn(l).some(isOwnEmail));
  return { senderEmail, onlyOwnSender, nip, lines };
}
