/**
 * Sita całej skrzynki (czyste funkcje). Maile od dostawców z kart idą jak dotąd; reszta:
 * 1. reguła nadawcy (adres albo domena z poddomenami) — „sprawa” od razu na tablicę, „odprawa” do odpraw
 *    celnych (agencje, spedytorzy), „ignoruj” w ogóle nie wchodzi;
 * 2. automaty (noreply, powiadomienia, newslettery) — nie wchodzą;
 * 3. nieznany człowiek — półka „Do przejrzenia”; decyzja z zapamiętaniem tworzy regułę.
 */

export type SenderDecision = "case" | "ignore" | "customs";
export type SenderRule = { pattern: string; decision: SenderDecision };

/** Poczta prywatna — reguła na całą domenę objęłaby pół internetu. */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "wp.pl",
  "o2.pl",
  "onet.pl",
  "op.pl",
  "interia.pl",
  "interia.eu",
  "poczta.fm",
  "gazeta.pl",
  "tlen.pl",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "gmx.de",
  "gmx.net",
  "web.de",
]);

const AUTOMATED_LOCAL_RE =
  /^(no-?reply|do-?not-?reply|noreply|mailer-daemon|postmaster|notifications?|notify|alerts?|powiadomieni[ae]|automat|system|bounce|newsletter|news|marketing|info-?news|mailing|support-?noreply)([+._-].*)?$/i;

export function domainOf(email: string): string {
  const at = email.lastIndexOf("@");
  return at < 0 ? "" : email.slice(at + 1).toLowerCase();
}

export function isFreeMailDomain(domain: string): boolean {
  return FREE_MAIL_DOMAINS.has(domain.toLowerCase());
}

/** Wzorzec reguły: adres albo „@domena” (dla poczty prywatnej tylko adres). */
export function rulePattern(email: string, scope: "sender" | "domain"): string | null {
  const e = email.trim().toLowerCase();
  const domain = domainOf(e);
  if (!domain) return null;
  if (scope === "domain") return isFreeMailDomain(domain) ? null : `@${domain}`;
  return e;
}

/** Reguła dla nadawcy: adres wygrywa z domeną, domena z najbliższą nadrzędną („pl.fracht.com” → „@fracht.com”). */
export function senderDecision(rules: readonly SenderRule[], email: string): SenderDecision | null {
  const e = email.trim().toLowerCase();
  const byAddress = rules.find((r) => r.pattern === e);
  if (byAddress) return byAddress.decision;
  const labels = domainOf(e).split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const hit = rules.find((r) => r.pattern === `@${labels.slice(i).join(".")}`);
    if (hit) return hit.decision;
  }
  return null;
}

/** Automat, nie człowiek: noreply, powiadomienia systemów, wysyłka masowa. */
export function isAutomatedSender(email: string, bulk: boolean): boolean {
  if (bulk) return true;
  const local = email.split("@")[0] ?? "";
  return AUTOMATED_LOCAL_RE.test(local);
}

/** Co zrobić z wiadomością od nadawcy spoza kart dostawców. null = pominąć. */
export function triageOther(input: {
  email: string;
  bulk: boolean;
  rules: readonly SenderRule[];
  /** Wątek jest już sprawą na tablicy — kolejne wiadomości dołączają bez pytania. */
  knownCaseThread: boolean;
}): "case" | "review" | "customs" | null {
  const decision = senderDecision(input.rules, input.email);
  if (decision === "ignore") return null;
  if (decision === "case" || input.knownCaseThread) return "case";
  // Agencje piszą też z automatów (powiadomienia o należnościach) — i tak należą do odpraw.
  if (decision === "customs") return "customs";
  if (isAutomatedSender(input.email, input.bulk)) return null;
  return "review";
}

/**
 * Co jest w mailu agencji / spedytora (odprawy celne):
 * dues = należności do zapłaty przed wydaniem towaru (przelew na już → Do zapłaty na tablicy),
 * documents = faktura spedytora / SAD / ZC429 (do Subiekta, nie do finansów), quote = wycena transportu,
 * pickup = awizacja / odbiór (do magazynu), request = prośba o dokumenty / tłumaczenie (odpowiedzieć).
 */
export type CustomsMailKind = "dues" | "documents" | "quote" | "pickup" | "request";

/** Co jest w mailu agencji celnej / spedytora i co z tym zrobić. */
export const CUSTOMS_KIND_LABELS: Record<CustomsMailKind, string> = {
  request: "prośba o dokumenty - odpowiedz",
  dues: "należności na już - przekaż do zapłaty",
  documents: "faktura / SAD - do Subiekta",
  quote: "wycena transportu",
  pickup: "awizacja / odbiór - przekaż magazynowi",
};

const DUES_RE = /nale[żz]no[śs]|wykaz nale|cło|clo\b|duty|duties|import (tax|vat)|op[łl]a[ćc] (cło|vat)|do zap[łl]aty/i;
/** Agencja czegoś od nas chce — nawet gdy w temacie jest „faktura” (np. tłumaczenie faktury). */
const REQUEST_RE = /t[łl]umacz|translat|pro[śs]ba o (dok|tłum|tlum|fakt|dan)|prosimy o|please (send|provide)|missing|brak(uje|ując)|potrzebuj/i;
const DOCUMENTS_RE = /faktur|invoice|rechnung|\bSAD\b|ZC ?429|PZC|nota (obc|kred)|zgłoszenie celne/i;
const QUOTE_RE = /wycen|oferta|offer|quotation|\bquote\b|rate request|stawk|pytanie o (transport|fracht)|freight|transport (z|ze|from)\b/i;
const PICKUP_RE = /awiz|odbi[oó]r|pick.?up|kierowc|dostaw[ay] (do|na)|zlecenie odbioru|delivery note/i;

export function customsMailKind(input: { subject: string; attachmentNames: readonly string[] }): CustomsMailKind {
  const text = `${input.subject} ${input.attachmentNames.join(" ")}`;
  if (DUES_RE.test(text)) return "dues";
  if (REQUEST_RE.test(input.subject)) return "request";
  if (DOCUMENTS_RE.test(text)) return "documents";
  if (QUOTE_RE.test(input.subject)) return "quote";
  if (PICKUP_RE.test(input.subject)) return "pickup";
  return "request";
}
