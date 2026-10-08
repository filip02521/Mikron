// Maile DHL Express o odprawie celnej — rozpoznanie po temacie, nadawcy i fragmencie treści.
// Jedna przesyłka = jeden AWB (10 cyfr); ta sama wiadomość przychodzi do kilku skrzynek i bywa
// przekazywana dalej (Fwd:), więc wszystko spina numer AWB, a nie wątek Gmaila.

export type DhlMailKind =
  /** Prośba agencji o dyspozycję (T#… w temacie) — trzeba odpisać. */
  | "request"
  /** „Prosimy o odpowiedź na wcześniej wysłaną wiadomość” — ponaglenie. */
  | "reminder"
  /** Pytanie / odpowiedź agencji w wątku T# (Re:). */
  | "agency"
  /**
   * Nasza odpowiedź do agencji: „Re: T#…” z firmy do DHL albo autoodpowiedź DHL „[T#…] Automatyczna
   * Odpowiedź” (dowód odpowiedzi także z niepodłączonej skrzynki — wtedy tylko numer sprawy, bez AWB).
   */
  | "replied"
  /** „Dziękujemy za dyspozycję” — agencja przyjęła odpowiedź. */
  | "confirmation"
  /** Komunikat z systemu celnego (PW429 / ZCX91 = zgłoszenie w toku, ZC429 = zwolnienie towaru). */
  | "customs"
  /** Cło / podatek do zapłaty (ADCPL „należnym cle”, agencja „PRZEDPŁATA należności”). */
  | "duties"
  /** Zapłacone: pokwitowanie DHL albo nasze potwierdzenie przelewu w odpowiedzi na „PRZEDPŁATA”. */
  | "paid"
  /** Doręczono (DHL On Demand Delivery) — tylko dla przesyłek, które już mamy. */
  | "delivered";

export type DhlMail = {
  kind: DhlMailKind;
  /** null tylko dla autoodpowiedzi z samym numerem sprawy — przesyłkę znajdujemy po `ticket`. */
  awb: string | null;
  /** Numer sprawy agencji, np. 1PO2608110000295 (bez „T#”). */
  ticket: string | null;
  /** Kod komunikatu celnego (ZC429, PW429, ZCX91). */
  customsCode: string | null;
  mrn: string | null;
  /** Kopia przekazana przez kogoś (Fwd:) — ta sama sprawa, nie nowa przesyłka. */
  forwarded: boolean;
};

export type DhlMailInput = {
  subject: string;
  from: string;
  /** Fragment treści (albo cała treść — gdy fragment nie zawiera numeru przesyłki). */
  snippet: string;
  /** To + Cc — odpowiedź do DHL czy rozmowa wewnątrz firmy / z dostawcą. */
  to?: string;
  attachmentNames?: readonly string[];
};

const PREFIX = /^\s*(re|odp|aw|fwd?|fw|pd|przekaż|wg)\s*:\s*/i;
const FORWARD = /^(fwd?|fw|pd|przekaż|wg)$/i;

/** Temat bez „Re:”, „Fwd:”, „PD:” (także zagnieżdżonych). */
export function stripSubjectPrefixes(subject: string): { subject: string; forwarded: boolean; reply: boolean } {
  let s = subject.trim();
  let forwarded = false;
  let reply = false;
  for (let m = PREFIX.exec(s); m; m = PREFIX.exec(s)) {
    if (FORWARD.test(m[1])) forwarded = true;
    else reply = true;
    s = s.slice(m[0].length);
  }
  return { subject: s.trim(), forwarded, reply };
}

const DHL_ADDRESS = /@dhl\.com\b/i;

function isDhl(from: string): boolean {
  return /@dhl\.com\s*>?\s*$/i.test(from.trim());
}

/** Fragment treści przekazanej wiadomości zaczyna się od nagłówka „Forwarded message”. */
function forwardedFromDhl(snippet: string): boolean {
  return /forwarded message[\s\S]{0,40}(od|from):[^\n]*@dhl\.com/i.test(snippet.replace(/&lt;|&gt;/g, " "));
}

const MRN = /\b(\d{2}PL[A-Z0-9]{10,16})\b/;
const AWB_IN_TEXT = /(?:listu przewozowego(?:\s+AWB)?|waybill number|DHL Express)\s+(\d{10})\b/i;

export function classifyDhlMail(input: DhlMailInput): DhlMail | null {
  const { subject, forwarded, reply } = stripSubjectPrefixes(input.subject);
  const snippet = input.snippet ?? "";
  const text = `${subject} ${snippet}`;
  const fromDhl = isDhl(input.from) || (forwarded && forwardedFromDhl(snippet));
  // Odpowiedź spoza DHL: do agencji (DHL wśród adresatów) albo rozmowa wewnętrzna / z dostawcą.
  const replyToDhl = !fromDhl && reply && !forwarded && DHL_ADDRESS.test(input.to ?? "");
  const internalReply = !fromDhl && reply && !replyToDhl;
  const base = { ticket: null, customsCode: null, mrn: null, forwarded };

  const customs = /odebranym komunikacie\s+([A-Z0-9]{4,6})\s*-\s*dot\.\s*AWB\s+(\d{10})(?:\s+([0-9]{2}PL[A-Z0-9]{10,16}))?/i.exec(subject);
  if (customs) {
    if (internalReply) return null;
    return { ...base, kind: "customs", awb: customs[2], customsCode: customs[1].toUpperCase(), mrn: customs[3] ?? null };
  }

  // Starszy format: „Powiadomienie o dokonanej odprawie importowej do przesylki o numerze <AWB>-(<MRN>)”,
  // kod komunikatu tylko w nazwach załączników (ZC429_<MRN>_1_PL.pdf / PW429_…).
  const done = /dokonanej odprawie importowej do przesy[lł]ki o numerze\s+(\d{10})/i.exec(subject);
  if (done) {
    if (internalReply) return null;
    const code = (input.attachmentNames ?? []).map((n) => /^(ZC429|PW429|ZCX91)_/i.exec(n)?.[1]).find(Boolean);
    return { ...base, kind: "customs", awb: done[1], customsCode: code?.toUpperCase() ?? "ZC429", mrn: MRN.exec(subject)?.[1] ?? null };
  }

  const prepay = /PRZEDPŁATA należności celno-podatkowych dot\. AWB:?\s*(\d{10})/i.exec(subject);
  if (prepay) {
    // Odpowiedź z firmy na wezwanie do przedpłaty = potwierdzenie przelewu.
    if (replyToDhl) return { ...base, kind: "paid", awb: prepay[1] };
    if (internalReply) return null;
    return { ...base, kind: "duties", awb: prepay[1] };
  }

  const ticket = /\[?T#\s*([A-Z0-9]+)\]?/i.exec(subject)?.[1]?.toUpperCase() ?? null;
  if (ticket && /Automatyczna Odpowied/i.test(subject) && isDhl(input.from)) {
    return { ...base, kind: "replied", awb: null, ticket };
  }

  const agency =
    /Agencja Celna DHL\s*[-–]\s*przesyłka numer:\s*(\d{10})/i.exec(subject) ??
    /Agencja Celna DHL\s*[-–]\s*prosimy o odpowiedź do przesyłki o numerze:?\s*(\d{10})/i.exec(subject);
  if (agency) {
    if (internalReply) return null;
    const lower = snippet.toLowerCase();
    let kind: DhlMailKind;
    if (replyToDhl) kind = "replied";
    else if (/prosimy o odpowiedź/i.test(subject) || lower.includes("prosimy o odpowiedź na wcześniej")) kind = "reminder";
    // 2026: „dziękujemy za dyspozycję”, 2025: „Dziękuję za dyspozycję”.
    else if (/dzi[eę]kuj(?:emy|ę) za dyspozycj/i.test(snippet)) kind = "confirmation";
    // Przekazana kopia bez rozpoznawalnej treści (fragment kończy się na nagłówku przekazania) —
    // dopiero pełna treść powie, czy to ponaglenie, potwierdzenie czy pytanie.
    else if (forwarded && !ticket) return null;
    // Prośba agencji zawsze ma numer sprawy (T#…); inny mail agencji w sprawie przesyłki = pytanie.
    else if (reply || !ticket) kind = "agency";
    else kind = "request";
    return { ...base, kind, awb: agency[1], ticket };
  }

  if (internalReply) return null;
  const awbInText = AWB_IN_TEXT.exec(snippet)?.[1] ?? null;
  if (!awbInText) return null;
  if (/należnym cle|opłacenie cła/i.test(text)) return { ...base, kind: "duties", awb: awbInText };
  if (/pokwitowanie (płatności|opłacenia)|potwierdzenie płatności/i.test(text)) return { ...base, kind: "paid", awb: awbInText };
  if (/On Demand Delivery/i.test(subject) && /DORĘCZONO/i.test(snippet)) return { ...base, kind: "delivered", awb: awbInText };
  return null;
}

/**
 * Temat wskazuje mail DHL, ale numer przesyłki jest dopiero w treści (przekazane „należnym cle”,
 * „Pokwitowanie opłacenia cła”) — wtedy warto doczytać całą treść i sklasyfikować jeszcze raz.
 */
export function dhlMailNeedsBody(subject: string): boolean {
  if (/należnym cle|pokwitowanie (płatności|opłacenia)/i.test(subject)) return true;
  const s = stripSubjectPrefixes(subject);
  return s.forwarded && /Agencja Celna DHL/i.test(s.subject) && !/T#/i.test(s.subject);
}

/**
 * Dzień założenia sprawy z numeru agencji: „1PO2604030000040” → 2026-04-03. Przekazanie bywa
 * dni / tygodnie później — termin składowania liczy się od prośby, nie od przekazania.
 */
export function dhlTicketDate(ticket: string | null): string | null {
  const m = /^\d?[A-Z]{2}(\d{2})(\d{2})(\d{2})\d{4,}$/i.exec(ticket ?? "");
  if (!m) return null;
  const [, yy, mm, dd] = m;
  if (Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31) return null;
  // Rano czasu polskiego (UTC+1/+2) — liczy się dzień, nie godzina.
  return `20${yy}-${mm}-${dd}T06:00:00.000Z`;
}

/**
 * Zwolnienie towaru — odprawa zakończona po stronie urzędu. Tylko ZC429: PW429 przychodzi wcześniej
 * (przed należnościami i przed ZC429), więc nie zamyka sprawy.
 */
export function isCustomsRelease(code: string | null): boolean {
  return code === "ZC429";
}

/** Gmail: wszystko, co dotyczy odpraw DHL (oryginały, przekazania i nasze odpowiedzi). */
export const DHL_GMAIL_QUERY =
  'from:(odprawacelna@dhl.com OR plpozecs@dhl.com OR ADCPL@dhl.com OR no-reply@dhl.com OR NoReply.ODD@dhl.com) OR ' +
  'subject:("Agencja Celna DHL" OR "odebranym komunikacie" OR "dokonanej odprawie importowej" OR ' +
  '"PRZEDPŁATA należności" OR "należnym cle" OR "Pokwitowanie opłacenia" OR "Pokwitowanie płatności DHL")';

/**
 * Pliki faktury z maila DHL: <AWB>.INV.*.(pdf|tif) — wielkość liter i format bywają różne
 * („7603442523.inv.hkg.hkc.7h6.20250721.141133.tif”), plików bywa kilka (także sam certyfikat).
 * <AWB>.AWB.* to list przewozowy — pomijamy.
 */
export function dhlInvoiceAttachments<T extends { filename: string }>(attachments: readonly T[], awb: string): T[] {
  const files = attachments.filter((a) => /\.(pdf|tiff?|jpe?g|png)$/i.test(a.filename));
  const inv = files.filter((a) => /(^|\.)inv\./i.test(a.filename));
  const own = inv.filter((a) => a.filename.startsWith(`${awb}.`));
  return [...(own.length ? own : inv)].sort((x, y) => x.filename.localeCompare(y.filename));
}

// Słowa, które nie wyróżniają firmy (miasta, forma prawna, branża) — „Shenzhen UP3D Technology Co., Ltd” → „up3d”.
const GENERIC_WORDS = new Set(
  (
    "co ltd limited inc corp corporation company gmbh ag sa srl sro bv llc plc sp zoo spolka " +
    "shenzhen shenzen ningbo dongguan guangzhou hangzhou shanghai beijing hong kong honkong hongkong china " +
    "technology technologies tech instruments instrument dental medical products product industrial " +
    "industry trading international group manufacturing precision oem the and of"
  ).split(" ")
);

export function supplierNameTokens(name: string): string[] {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((t) => t.length >= 2 && !GENERIC_WORDS.has(t));
}

/**
 * Dostawca z nazwy sprzedawcy na fakturze. Zwraca id tylko przy jednoznacznym trafieniu —
 * w razie wątpliwości lepiej zapytać, niż założyć odprawę na złego dostawcę.
 */
export function matchSupplierBySellerName(
  sellerName: string | null | undefined,
  suppliers: readonly { id: string; name: string }[]
): string | null {
  const seller = new Set(supplierNameTokens(sellerName ?? ""));
  if (!seller.size) return null;
  const sellerJoined = [...seller].join("");
  let best: { id: string; score: number } | null = null;
  let tie = false;
  for (const s of suppliers) {
    const tokens = supplierNameTokens(s.name);
    if (!tokens.length) continue;
    // „Song Young” na fakturze bywa jako „SONGYOUNG” — porównanie także bez spacji.
    const hits = tokens.filter((t) => seller.has(t) || (t.length >= 4 && sellerJoined.includes(t))).length;
    const score = hits / tokens.length;
    if (score < 0.5) continue;
    if (!best || score > best.score) {
      best = { id: s.id, score };
      tie = false;
    } else if (score === best.score) {
      tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

export type DhlStage = "request" | "replied" | "confirmed" | "declared" | "released";
const STAGE_RANK: Record<DhlStage, number> = { request: 0, replied: 1, confirmed: 2, declared: 3, released: 4 };

/** Etap po zdarzeniu — dalszy etap nie cofa się, chyba że agencja pyta ponownie (agency). */
export function nextStage(current: DhlStage, mail: Pick<DhlMail, "kind" | "customsCode">): DhlStage {
  // Cło do zapłaty / zapłacone = zgłoszenie już jest; doręczenie = towar zwolniony.
  const target: DhlStage | null =
    mail.kind === "replied"
      ? "replied"
      : mail.kind === "confirmation"
        ? "confirmed"
        : mail.kind === "customs"
          ? isCustomsRelease(mail.customsCode)
            ? "released"
            : "declared"
          : mail.kind === "duties" || mail.kind === "paid"
            ? "declared"
            : mail.kind === "delivered"
              ? "released"
              : null;
  if (mail.kind === "agency" && current === "replied") return "request";
  if (!target) return current;
  return STAGE_RANK[target] > STAGE_RANK[current] ? target : current;
}
