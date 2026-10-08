/**
 * Poczta dostawców — czyste reguły (bez bazy i Gmaila): kto jest nadawcą-dostawcą, jakie zapytania
 * wysłać do Gmaila i do której sprawy (wysłane ZD / zapytanie z tablicy) przypiąć wiadomość.
 */

import { emailsInText } from "@/lib/email/supplier-emails";

/** Domeny skrzynek ogólnych — po nich nie da się poznać dostawcy, tylko po pełnym adresie. */
const GENERIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "wp.pl",
  "o2.pl",
  "onet.pl",
  "onet.eu",
  "op.pl",
  "interia.pl",
  "interia.eu",
  "poczta.fm",
  "tlen.pl",
  "gazeta.pl",
  "vp.pl",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "gmx.de",
  "gmx.net",
  "web.de",
  "t-online.de",
  "qq.com",
  "163.com",
  "126.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "yahoo.de",
  "yahoo.co.uk",
  "hotmail.de",
  "hotmail.co.uk",
  "outlook.de",
  "mail.ru",
  "yandex.ru",
  "zoho.com",
  "seznam.cz",
  "wp.eu",
  "go2.pl",
]);

export type SupplierCard = {
  id: string;
  mails: string | null;
  notes: string | null;
  extra_info: string | null;
};

export type SenderIndex = {
  /** Pełny adres → dostawcy (adresy z domen ogólnych i wszystkie z kart). */
  byAddress: Map<string, string[]>;
  /** Domena firmowa → dostawcy (kilka kart może mieć tę samą domenę). */
  byDomain: Map<string, string[]>;
};

function push(map: Map<string, string[]>, key: string, id: string) {
  const list = map.get(key);
  if (!list) map.set(key, [id]);
  else if (!list.includes(id)) list.push(id);
}

export function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

export function isGenericDomain(domain: string): boolean {
  return GENERIC_DOMAINS.has(domain.toLowerCase());
}

/** Indeks nadawców z kart dostawców (maile, notatki, dodatkowe info; bez loginów do portali i Mikranu). */
export function buildSenderIndex(cards: readonly SupplierCard[]): SenderIndex {
  const byAddress = new Map<string, string[]>();
  const byDomain = new Map<string, string[]>();
  for (const card of cards) {
    // Domena tylko z pola „maile” — w notatkach bywają spedytorzy i klienci (cała ich poczta trafiłaby do Poczty).
    const cardMails = new Set(emailsInText(card.mails ?? ""));
    for (const email of emailsInText(`${card.mails ?? ""} ${card.notes ?? ""} ${card.extra_info ?? ""}`)) {
      push(byAddress, email, card.id);
      const domain = domainOf(email);
      if (cardMails.has(email) && domain && !isGenericDomain(domain) && !/mikran\./.test(domain)) push(byDomain, domain, card.id);
    }
  }
  return { byAddress, byDomain };
}

/** Dostawcy pasujący do nadawcy: najpierw pełny adres, potem domena firmowa. */
export function suppliersForSender(index: SenderIndex, email: string): string[] {
  const address = email.trim().toLowerCase();
  return index.byAddress.get(address) ?? index.byDomain.get(domainOf(address)) ?? [];
}

/** Elementy zapytania Gmaila: domeny firmowe + pełne adresy z domen ogólnych. */
export function senderSearchTerms(index: SenderIndex): string[] {
  const terms = new Set<string>(index.byDomain.keys());
  for (const address of index.byAddress.keys()) {
    if (isGenericDomain(domainOf(address))) terms.add(address);
  }
  return [...terms].sort();
}

/** Zapytania Gmaila (`from:(a OR b …) after:…`) w paczkach — długie zapytanie Gmail ucina. */
export function gmailSenderQueries(terms: readonly string[], after: Date, maxLength = 1200): string[] {
  const suffix = ` after:${Math.floor(after.getTime() / 1000)} -in:sent -in:drafts -in:chats`;
  const queries: string[] = [];
  let batch: string[] = [];
  const flush = () => {
    if (batch.length) queries.push(`from:(${batch.join(" OR ")})${suffix}`);
    batch = [];
  };
  for (const term of terms) {
    if (batch.length && `from:(${[...batch, term].join(" OR ")})${suffix}`.length > maxLength) flush();
    batch.push(term);
  }
  flush();
  return queries;
}

/** Zapytanie o zwroty (mail nie doszedł) — przypinane tylko po wątku naszej wysyłki. */
export function gmailBounceQuery(after: Date): string {
  return `from:(mailer-daemon OR postmaster) after:${Math.floor(after.getTime() / 1000)}`;
}

/** „Jan Kowalski <jan@x.pl>” → { email, name }. */
export function parseFromHeader(from: string): { email: string; name: string } {
  const angle = from.match(/<([^>]+)>/);
  const email = (angle?.[1] ?? from).trim().toLowerCase().replace(/^mailto:/, "");
  const name = angle ? from.slice(0, angle.index).replace(/"/g, "").trim() : "";
  return { email, name };
}

export type DocumentRefs = {
  /** „70/M/10/2026” z „ZD 70/M/10/2026”. */
  dokNrs: string[];
  /** Id dokumentu Subiekta z „ZD #1869309”. */
  dokIds: number[];
  /** Znacznik zapytania z tablicy „[OnTime #fec3e5f1]”. */
  inquiryRefs: string[];
};

/** Numery ZD i znaczniki zapytań w temacie, treści i nazwach załączników. */
export function documentRefs(text: string): DocumentRefs {
  // Numer ZD z Subiekta („26/M/10/2026”) — z przedrostkiem „ZD” albo bez (dostawcy często go gubią:
  // „AW: New order 26/M/10/2026”). Litera magazynu 1–2 znaki, więc numery faktur („F/001585/10/2026”) nie pasują.
  const dokNrs = [...text.matchAll(/(?<![\dA-Za-z/])(\d{1,6}\/[A-Z]{1,2}\/\d{2}\/\d{4})(?![\d/])/gi)].map((m) => m[1]!.toUpperCase());
  const dokIds = [...text.matchAll(/(?<![A-Za-z])ZD\s*#\s*(\d{5,9})\b/gi)].map((m) => Number(m[1]));
  const inquiryRefs = [...text.matchAll(/\[OnTime #([0-9a-f]{8})\]/gi)].map((m) => m[1]!.toLowerCase());
  return { dokNrs: [...new Set(dokNrs)], dokIds: [...new Set(dokIds)], inquiryRefs: [...new Set(inquiryRefs)] };
}

export type MailCase = {
  kind: "zd" | "inquiry";
  id: string;
  supplierId: string | null;
  /** Wątek wysłanej wiadomości w skrzynce nadawcy. */
  threadId: string | null;
  /** Pełny numer ZD („ZD 70/M/10/2026”) — tylko ZD. */
  dokNr: string | null;
  dokId: number | null;
  /** Wątek tablicy — tylko zapytania (znacznik = pierwsze 8 znaków id bez myślników). */
  boardThreadId: string | null;
  sentAt: string;
  resolved: boolean;
};

export type CaseLink = { caseKind: "zd" | "inquiry"; caseId: string; linkedBy: "thread" | "document" | "supplier" };

/**
 * Do której sprawy należy wiadomość: ten sam wątek → numer ZD / znacznik zapytania w treści →
 * ostatnie otwarte ZD jedynego pasującego dostawcy. Brak pewności → null (wiadomość bez sprawy).
 */
export function linkToCase(
  msg: {
    threadId: string;
    text: string;
    supplierIds: readonly string[];
    /** Zgadywanie po dostawcy tylko dla odpowiedzi / potwierdzeń — faktura nie „odpowiada” na ZD. */
    category?: SupplierMailCategory;
    /** Zgadywane ZD musi być wysłane przed mailem — starszy mail nie jest odpowiedzią na nie. */
    receivedAt?: string;
  },
  cases: readonly MailCase[]
): CaseLink | null {
  const byThread = cases.find((c) => c.threadId && c.threadId === msg.threadId);
  if (byThread) return { caseKind: byThread.kind, caseId: byThread.id, linkedBy: "thread" };

  const refs = documentRefs(msg.text);
  const byDocument = cases.find((c) => {
    if (c.kind === "zd") {
      const nr = c.dokNr?.replace(/^ZD\s*/i, "").toUpperCase() ?? "";
      return (nr && refs.dokNrs.includes(nr)) || (c.dokId != null && refs.dokIds.includes(c.dokId));
    }
    const ref = c.boardThreadId?.replace(/-/g, "").slice(0, 8).toLowerCase();
    return Boolean(ref && refs.inquiryRefs.includes(ref));
  });
  if (byDocument) return { caseKind: byDocument.kind, caseId: byDocument.id, linkedBy: "document" };

  if (msg.supplierIds.length !== 1) return null;
  if (msg.category && !categoryNeedsAction(msg.category)) return null;
  const latestOpenZd = cases
    .filter(
      (c) =>
        c.kind === "zd" &&
        !c.resolved &&
        c.supplierId === msg.supplierIds[0] &&
        (!msg.receivedAt || Date.parse(c.sentAt) < Date.parse(msg.receivedAt))
    )
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
  return latestOpenZd ? { caseKind: "zd", caseId: latestOpenZd.id, linkedBy: "supplier" } : null;
}

/**
 * Rodzaj maila od dostawcy — decyduje, czy trafia do „Do reakcji”:
 * reply / confirmation (odpowiedź, potwierdzenie zamówienia) → do reakcji; invoice / shipping → dokumenty;
 * newsletter → pomijany.
 */
export type SupplierMailCategory = "reply" | "confirmation" | "invoice" | "shipping" | "newsletter";

const NEWSLETTER_FROM_RE = /^(news|newsletter|marketing|promo|promocje|mailing|info-?news)@/i;
/** Reklamy wysyłane zwykłą pocztą (bez List-Unsubscribe) — po temacie. */
const PROMO_SUBJECT_RE = /promocj|promotion|newsletter|webinar|black friday|oferta hurtowa|wyprzeda[zż]|\bsale\b/i;
const INVOICE_RE = /faktur|invoice|rechnung|factura|fattura|facture|credit note|nota kredyt|korekt|\bFV[ /-]?\d/i;
const SHIPPING_RE =
  /tracking|shipment|versand|lieferschein|delivery note|albar[aá]n|wysy[lł]k|przesy[lł]k|\bWZ\b|dispatch|spedizion|\bDDT\b|list przewozowy|\bAWB\b/i;
const CONFIRMATION_RE =
  /confirm|best[aä]tig|potwierdz|conferma|confirmaci|auftragsbest|(?<![A-Za-z])(?:AB|PI|OC)(?![A-Za-z])|sales order|order acknowledg|pro.?forma/i;

export function supplierMailCategory(input: {
  from: string;
  subject: string;
  attachmentNames: readonly string[];
  /** Nagłówek List-Unsubscribe / Precedence: bulk — wysyłka masowa. */
  bulk: boolean;
}): SupplierMailCategory {
  const email = parseFromHeader(input.from).email;
  const subject = input.subject;
  // Odpowiedź w naszym wątku („Re: …”) nie jest reklamą, nawet gdy w temacie jest „promocja”.
  const isReply = /^\s*(re|odp|aw|r|antwort|sv)\s*:/i.test(subject);
  if (input.bulk || NEWSLETTER_FROM_RE.test(email) || (!isReply && PROMO_SUBJECT_RE.test(subject))) return "newsletter";
  const files = input.attachmentNames.join(" ");
  // Odpowiedź w wątku („RE: Zamówienie”) z potwierdzeniem w załączniku to potwierdzenie, z fakturą — faktura.
  if (INVOICE_RE.test(subject) || (INVOICE_RE.test(files) && !CONFIRMATION_RE.test(files))) return "invoice";
  if (SHIPPING_RE.test(subject)) return "shipping";
  if (CONFIRMATION_RE.test(subject) || CONFIRMATION_RE.test(files)) return "confirmation";
  if (SHIPPING_RE.test(files)) return "shipping";
  return "reply";
}

/** Do reakcji (odpowiedzieć / sprawdzić z ZD); faktury i wysyłki to dokumenty do zaksięgowania lub informacji. */
export function categoryNeedsAction(category: SupplierMailCategory): boolean {
  return category === "reply" || category === "confirmation";
}
