/**
 * Sita całej skrzynki (czyste funkcje). Maile od dostawców z kart idą jak dotąd; reszta:
 * 1. reguła nadawcy (adres albo domena) — „sprawa” od razu na tablicę, „ignoruj” w ogóle nie wchodzi;
 * 2. automaty (noreply, powiadomienia, newslettery) — nie wchodzą;
 * 3. nieznany człowiek — półka „Do przejrzenia”; decyzja z zapamiętaniem tworzy regułę.
 */

export type SenderDecision = "case" | "ignore";
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

/** Reguła dla nadawcy: adres wygrywa z domeną. */
export function senderDecision(rules: readonly SenderRule[], email: string): SenderDecision | null {
  const e = email.trim().toLowerCase();
  const byAddress = rules.find((r) => r.pattern === e);
  if (byAddress) return byAddress.decision;
  const domain = domainOf(e);
  return rules.find((r) => r.pattern === `@${domain}`)?.decision ?? null;
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
}): "case" | "review" | null {
  const decision = senderDecision(input.rules, input.email);
  if (decision === "ignore") return null;
  if (decision === "case" || input.knownCaseThread) return "case";
  if (isAutomatedSender(input.email, input.bulk)) return null;
  return "review";
}
