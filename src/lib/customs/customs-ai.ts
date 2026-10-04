/**
 * AI (Gemini) dla odpraw: odczyt faktury, lista artykułów z dokumentu dostawcy,
 * propozycje opisu PL / materiału / kodu CN. AI tylko proponuje — człowiek zatwierdza.
 *
 * Funkcje parse* i build* są czyste (testowalne); wywołanie Gemini w {@link callCustomsGemini}.
 */

import { Type } from "@google/genai";
import {
  GEMINI_QUOTA_EXCEEDED_USER_MESSAGE,
  TimeoutError,
  geminiGenerateConfig,
  geminiModelCandidates,
  getGenAI,
  isGeminiQuotaExceeded,
  isRetryableGeminiError,
  withTimeout,
} from "@/lib/teeth/teeth-vision-gemini";
import { customsArticleKey, normalizeArticleCode, normalizeCnCode } from "./customs-clearance";
import {
  isInvoiceChargeName,
  normalizeInvoiceHsCode,
  parseLooseNumber,
  type CustomsInputLine,
} from "./customs-lines";

/** Poniżej maxDuration stron odpraw (300 s). */
export const CUSTOMS_GEMINI_TIMEOUT_MS = 180_000;

export type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

export class CustomsAiUnavailableError extends Error {
  constructor() {
    super("Brak klucza GOOGLE_AI_API_KEY — funkcje AI są wyłączone.");
    this.name = "CustomsAiUnavailableError";
  }
}

export function isCustomsAiConfigured(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
}

/** Wywołanie Gemini z odpowiedzią JSON wg schematu; przy przeciążeniu — kolejny model. */
export async function callCustomsGemini(parts: GeminiPart[], responseSchema: object): Promise<unknown> {
  const apiKey = process.env.GOOGLE_AI_API_KEY?.trim();
  if (!apiKey) throw new CustomsAiUnavailableError();
  const genAI = getGenAI(apiKey);
  let lastError: unknown = null;
  for (const model of geminiModelCandidates()) {
    try {
      const result = await withTimeout(
        genAI.models.generateContent({
          model,
          contents: [{ role: "user", parts }],
          config: geminiGenerateConfig(model, responseSchema),
        }),
        CUSTOMS_GEMINI_TIMEOUT_MS
      );
      return JSON.parse(result.text ?? "null");
    } catch (error) {
      lastError = error;
      if (isGeminiQuotaExceeded(error) || !isRetryableGeminiError(error)) throw error;
      console.warn(`[customs-ai] ${model} unavailable — trying fallback model…`);
    }
  }
  throw lastError ?? new Error("Gemini unavailable");
}

export function userFacingCustomsAiError(error: unknown): string {
  if (error instanceof CustomsAiUnavailableError) return error.message;
  if (error instanceof TimeoutError) return "AI nie odpowiedziało na czas. Spróbuj ponownie.";
  if (isGeminiQuotaExceeded(error)) return GEMINI_QUOTA_EXCEEDED_USER_MESSAGE;
  if (isRetryableGeminiError(error)) return "Serwer Google AI jest przeciążony. Spróbuj za minutę.";
  if (error instanceof SyntaxError) return "AI zwróciło nieczytelną odpowiedź. Spróbuj ponownie.";
  const msg = error instanceof Error ? error.message : String(error ?? "");
  if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(msg)) {
    return "Klucz GOOGLE_AI_API_KEY jest nieprawidłowy lub bez dostępu do Gemini — sprawdź konfigurację serwera.";
  }
  return "Nie udało się wykonać analizy AI. Spróbuj ponownie albo uzupełnij dane ręcznie.";
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
}

function asArray(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => x != null && typeof x === "object") : [];
}

// ─── Faktura ──────────────────────────────────────────────────────────────

export const INVOICE_EXTRACTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    invoiceNumber: { type: Type.STRING },
    invoiceDate: { type: Type.STRING, description: "YYYY-MM-DD" },
    currency: { type: Type.STRING, description: "ISO 4217, np. EUR, USD, CNY" },
    total: { type: Type.NUMBER, nullable: true },
    goodsTotal: { type: Type.NUMBER, nullable: true, description: "Wartość samych towarów (Total Goods Value), jeśli podana" },
    hsCode: { type: Type.STRING, nullable: true },
    countryOfOrigin: { type: Type.STRING, nullable: true },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Numer artykułu z osobnej kolumny; puste, gdy go nie ma" },
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER, nullable: true },
          amount: { type: Type.NUMBER, nullable: true },
          hsCode: { type: Type.STRING, nullable: true, description: "Kod HS / Commodity Code przy pozycji" },
          group: {
            type: Type.STRING,
            nullable: true,
            description: "Opis grupy produktów ze scalonej komórki obejmującej tę pozycję, np. Dental Lithium Disilicate Glass Ceramic",
          },
          kind: { type: Type.STRING, enum: ["goods", "charge"] },
        },
        required: ["code", "name", "quantity", "kind"],
      },
    },
  },
  required: ["invoiceNumber", "lines"],
} as const;

export const INVOICE_EXTRACTION_PROMPT = `Odczytaj fakturę handlową (commercial invoice) dostawcy spoza UE — może to być skan.

1. Czytaj tylko fakturę i jej ciąg dalszy z pozycjami („Attachment”, „Same as attached”, kolejne strony tabeli).
   Pomiń packing listę, specyfikację wag, pełnomocnictwa, certyfikaty i inne dokumenty w tym samym pliku —
   pozycji z packing listy NIE dopisuj drugi raz.
2. Każdy wiersz tabeli z ilością to jedna pozycja, w kolejności z faktury. Nie łącz i nie dziel wierszy.
   Nagłówki sekcji bez ilości (np. „MICRO MOTOR HANDPIECE”, „PARTS OF …”) pomiń.
   Numer artykułu w jednym wierszu, a opis w następnym — to jedna pozycja.
3. code: numer artykułu dostawcy tylko z osobnej kolumny (Item no., Art. no., Code, Ref, Model).
   Gdy takiej kolumny nie ma albo stoi w niej „/” lub „-” — zostaw puste. Liczba porządkowa (No., Lp.) to nie kod.
   Nie wycinaj kodu z opisu: „105L(BL):COLLET CHUCK "A"” to w całości name, code puste.
4. name: opis dokładnie jak na fakturze, bez tłumaczenia. Gdy jest nazwa produktu i osobny krótki opis
   (np. „Pionext Mini” + „printer”), połącz je: „Pionext Mini printer”.
5. kind: "goods" — towar; "charge" — koszt, który nie jest towarem (shipping fee, freight, transport,
   ubezpieczenie, opłata bankowa, opakowanie, rabat). Koszty z podsumowania pod tabelą
   („Freight Cost: 180.00”, „DHL charge”) też zwróć jako pozycje "charge" z kwotą w amount.
6. quantity — ilość; unitPrice — cena jednostkowa; amount — wartość wiersza.
   Pozycja bez wartości handlowej („N.C.V.”, „free of charge”, „no commercial value”): unitPrice 0, amount 0.
   hsCode pozycji — kod z kolumny Commodity Code / HS Code przy tej pozycji (gdy są dwa, np. „IB:… OB:…”, weź IB).
   group — opis grupy produktów, gdy tabela ma kolumnę opisu w scalonej komórce obejmującej kilka wierszy
   (np. „Dental Lithium Disilicate Glass Ceramic” obok modeli „LT VBL2-R(18-15-13)”, „PMMA Block” obok „D98-25 A3”).
   Wpisz go w group KAŻDEJ pozycji, którą komórka obejmuje — także na kolejnych stronach, dopóki nie zacznie się
   nowa grupa. Nie doklejaj grupy do name: name to tylko model / specyfikacja z wiersza.
7. invoiceDate jako YYYY-MM-DD: „April 28, 2026” → 2026-04-28, „2026/08/10” → 2026-08-10,
   „20260327” → 2026-03-27, chiński zapis „26/7/7” (RR/M/D) → 2026-07-07.
8. currency jako kod ISO (EUR, USD, CNY). total — kwota końcowa faktury (TOTAL / SAY TOTAL / Total Invoice Amount).
   goodsTotal — wartość samych towarów, gdy faktura ją podaje osobno (Total Goods Value, Sub-total).
   countryOfOrigin — kraj pochodzenia towaru („Country of origin”, „MADE IN KOREA”). hsCode — kod HS z faktury, jeśli jest.
Nie zgaduj — zostaw puste pole, gdy wartości nie widać.`;

export type InvoiceCharge = { name: string; amount: number | null };

export type InvoiceExtraction = {
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string | null;
  total: number | null;
  /** Wartość samych towarów (bez frachtu), gdy faktura ją podaje. */
  goodsTotal?: number | null;
  hsCode: string | null;
  countryOfOrigin: string | null;
  lines: CustomsInputLine[];
  /** Koszty z faktury, które nie są towarem (wysyłka, fracht) — nie trafiają do pozycji odprawy. */
  charges?: InvoiceCharge[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Data faktury z zapisów spotykanych u dostawców spoza UE. Niejednoznacznych zapisów
 * z dwucyfrowym rokiem („26/7/7”) nie zgadujemy — tu decyduje AI wg instrukcji.
 */
export function parseInvoiceDate(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return isoDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return isoDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) return isoDate(+m[3]!, +m[2]!, +m[1]!);
  m = s.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);
  if (m && MONTHS[m[1]!.toLowerCase()]) return isoDate(+m[3]!, MONTHS[m[1]!.toLowerCase()]!, +m[2]!);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\.?\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4})$/i);
  if (m && MONTHS[m[2]!.toLowerCase()]) return isoDate(+m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!);
  return null;
}

/** „U.S. DOLLARS”, „US$”, „€”, „RMB” → kod ISO. */
export function normalizeCurrency(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toUpperCase();
  if (!s) return null;
  if (/^[A-Z]{3}$/.test(s)) return s === "RMB" ? "CNY" : s;
  if (/US\s*\$|U\.?S\.?\s*DOLLAR|^\$$/.test(s)) return "USD";
  if (/€|EURO/.test(s)) return "EUR";
  if (/RMB|YUAN|¥/.test(s)) return "CNY";
  if (/£|POUND/.test(s)) return "GBP";
  if (/FRANC|CHF/.test(s)) return "CHF";
  if (/YEN|JPY/.test(s)) return "JPY";
  return null;
}

/** AI bywa niekonsekwentne i dokleja grupę do nazwy — nazwa jest kluczem karty, więc ją odcinamy. */
function withoutGroupPrefix(name: string, group: string): string {
  const g = group.trim();
  if (!g || !name.toLowerCase().startsWith(g.toLowerCase())) return name;
  return name.slice(g.length).replace(/^[\s:;,–-]+/, "") || name;
}

export function parseInvoiceExtraction(raw: unknown): InvoiceExtraction {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rows = asArray(obj.lines)
    .map((l) => {
      const code = str(l.code);
      const quantity = parseLooseNumber(str(l.quantity)) ?? 0;
      const unitPrice = parseLooseNumber(str(l.unitPrice));
      const amount = parseLooseNumber(str(l.amount));
      return {
        code: customsArticleKey(code, "") ? code : "",
        name: withoutGroupPrefix(str(l.name), str(l.group)),
        quantity,
        unitPrice,
        amount: amount ?? (unitPrice != null ? Math.round(unitPrice * quantity * 100) / 100 : null),
        hsCode: normalizeInvoiceHsCode(str(l.hsCode)),
        group: str(l.group).slice(0, 200),
        charge: str(l.kind) === "charge" || (!customsArticleKey(code, "") && isInvoiceChargeName(str(l.name))),
      };
    })
    .filter((l) => l.code || l.name);

  // Ten sam „kod” przy różnych nazwach to nie numer artykułu, tylko model (Saeshin „105L(BL)” + część).
  // Wtedy cała kolumna kodów jest niewiarygodna — kluczem każdej pozycji jest pełna nazwa
  // („F100III:CORD ASS'Y”), inaczej części modelu wpadłyby w jedną kartę, a pojedyncze modele
  // dostałyby inny klucz niż przy kolejnym odczycie tej samej faktury.
  const namesByCode = new Map<string, Set<string>>();
  for (const l of rows) {
    if (!l.code) continue;
    const key = normalizeArticleCode(l.code);
    namesByCode.set(key, (namesByCode.get(key) ?? new Set()).add(l.name.toUpperCase()));
  }
  // Jeden powtórzony kod (dwa warianty jednego artykułu) to jeszcze nie model — wtedy rozdzielamy
  // tylko tę grupę. Kilka takich kodów albo większość pozycji w nich (Saeshin) → cała kolumna to modele.
  const ambiguousCodes = new Set([...namesByCode].filter(([, names]) => names.size > 1).map(([code]) => code));
  const codedRows = rows.filter((l) => l.code).length;
  const rowsInAmbiguous = rows.filter((l) => l.code && ambiguousCodes.has(normalizeArticleCode(l.code))).length;
  const codesAreModels = ambiguousCodes.size >= 2 || (codedRows > 0 && rowsInAmbiguous / codedRows >= 0.5);

  const lines: CustomsInputLine[] = [];
  const charges: InvoiceCharge[] = [];
  for (const l of rows) {
    if (l.charge) {
      // „shipping cost 0.00” (PioCreat) — wiersz stopki bez kwoty, nie ma o czym ostrzegać.
      if (l.amount !== 0) charges.push({ name: l.name || l.code, amount: l.amount });
      continue;
    }
    if (l.quantity <= 0) continue;
    const merge = Boolean(l.code) && (codesAreModels || ambiguousCodes.has(normalizeArticleCode(l.code)));
    const name = merge && !l.name.toUpperCase().startsWith(l.code.toUpperCase()) ? `${l.code}:${l.name}` : l.name;
    lines.push({
      supplierArticleCode: merge ? "" : normalizeArticleCode(l.code),
      supplierName: name,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      subiektTwId: null,
      ...(l.hsCode ? { invoiceHsCode: l.hsCode } : {}),
      ...(l.group ? { invoiceGroup: l.group } : {}),
    });
  }

  const goodsTotal = parseLooseNumber(str(obj.goodsTotal));
  return {
    invoiceNumber: str(obj.invoiceNumber).slice(0, 120),
    invoiceDate: parseInvoiceDate(str(obj.invoiceDate)),
    currency: normalizeCurrency(str(obj.currency)),
    total: parseLooseNumber(str(obj.total)),
    ...(goodsTotal != null ? { goodsTotal } : {}),
    hsCode: str(obj.hsCode) || null,
    countryOfOrigin: str(obj.countryOfOrigin) || null,
    lines,
    ...(charges.length ? { charges } : {}),
  };
}

function money(n: number, currency: string | null): string {
  return `${n.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${currency ? ` ${currency}` : ""}`;
}

/**
 * Uwagi po odczycie faktury: pominięte koszty i zgodność sumy pozycji z kwotą faktury
 * (różnica zwykle oznacza zdublowaną packing listę albo zgubiony wiersz).
 */
export function invoiceReadWarnings(invoice: InvoiceExtraction): string[] {
  const out: string[] = [];
  const charges = invoice.charges ?? [];
  if (charges.length) {
    out.push(
      `Pominięto koszty spoza towaru: ${charges
        .map((c) => (c.amount != null ? `${c.name} (${money(c.amount, invoice.currency)})` : c.name))
        .join(", ")}.`
    );
  }
  const goods = invoice.lines.reduce((sum, l) => sum + (l.unitPrice ?? 0) * l.quantity, 0);
  const extra = charges.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  // „Total Goods Value” porównujemy z samymi towarami; kwotę końcową — z towarami i kosztami.
  const [expected, actual] =
    invoice.goodsTotal != null && invoice.goodsTotal > 0
      ? [invoice.goodsTotal, goods]
      : [invoice.total ?? 0, goods + extra];
  if (expected > 0 && invoice.lines.length && Math.abs(actual - expected) > Math.max(1, expected * 0.005)) {
    out.push(
      `Suma pozycji ${money(actual, invoice.currency)} nie zgadza się z kwotą faktury ${money(expected, invoice.currency)} — sprawdź, czy żadna pozycja nie jest zdublowana ani pominięta.`
    );
  }
  return out;
}

/** Pozycje w formacie pola „wklej z faktury” (kod ⇥ nazwa ⇥ ilość ⇥ cena) — do przejrzenia przed utworzeniem. */
export function invoiceLinesToPasteText(lines: readonly CustomsInputLine[]): string {
  return lines
    .map((l) =>
      [
        l.supplierArticleCode,
        l.supplierName.replace(/\t/g, " "),
        String(l.quantity).replace(".", ","),
        l.unitPrice != null ? String(l.unitPrice).replace(".", ",") : "",
        l.invoiceHsCode ?? "",
        (l.invoiceGroup ?? "").replace(/\t/g, " "),
      ]
        .join("\t")
        .replace(/\t+$/, "")
    )
    .join("\n");
}

// ─── Dokument dostawcy (Annex A) ──────────────────────────────────────────

export const DOCUMENT_ARTICLES_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    articles: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ["code"],
      },
    },
  },
  required: ["articles"],
} as const;

export const DOCUMENT_ARTICLES_PROMPT = `To dokument dostawcy do odprawy celnej (np. deklaracja zgodności z załącznikiem Annex A, certyfikat).
Wypisz WSZYSTKIE numery artykułów (kody produktów, np. DE-1411), których dokument dotyczy — zwykle w tabeli lub liście załącznika.
Do każdego kodu dodaj krótki opis z dokumentu. Nie dopisuj kodów, których nie ma w dokumencie.`;

export function parseDocumentArticlesExtraction(raw: unknown): { code: string; description: string }[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const out: { code: string; description: string }[] = [];
  for (const a of asArray(obj.articles)) {
    const code = normalizeArticleCode(str(a.code));
    if (!code || /\s/.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, description: str(a.description).slice(0, 300) });
  }
  return out;
}

/** Tekst do pola listy artykułów (kod ⇥ opis). */
export function documentArticlesToPasteText(articles: readonly { code: string; description: string }[]): string {
  return articles.map((a) => (a.description ? `${a.code}\t${a.description}` : a.code)).join("\n");
}

// ─── Propozycje opisów ────────────────────────────────────────────────────

export const LINE_PROPOSALS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ref: { type: Type.STRING },
          descriptionPl: { type: Type.STRING },
          material: { type: Type.STRING },
          cnCode: { type: Type.STRING, description: "8 cyfr CN" },
          cnCertain: { type: Type.BOOLEAN, description: "false, gdy klasyfikacja jest wątpliwa" },
          cnReason: { type: Type.STRING, description: "Krótkie uzasadnienie kodu (pozycja / uwaga), max 120 znaków" },
        },
        required: ["ref", "descriptionPl", "material", "cnCode", "cnCertain", "cnReason"],
      },
    },
  },
  required: ["items"],
} as const;

export type ProposalExample = { supplierName: string; descriptionPl: string; material: string; cnCode: string | null };
export type ProposalRequestLine = {
  ref: string;
  code: string;
  supplierName: string;
  documentDescription?: string;
  /** Kod HS nadawcy z faktury — wskazówka, nie gotowy kod CN. */
  invoiceHsCode?: string | null;
  /** Opis grupy z faktury („Dental Lithium Disilicate Glass Ceramic”) — określa materiał. */
  invoiceGroup?: string | null;
  /** Opis PL już ustalony (np. z wcześniejszego maila) — AI dobiera tylko kod CN i materiał. */
  knownDescriptionPl?: string;
};

function formatExamples(examples: readonly ProposalExample[], limit: number): string {
  return examples
    .slice(0, limit)
    .map((e) => `- "${e.supplierName}" → opis: "${e.descriptionPl}", materiał: "${e.material}", CN: ${e.cnCode ?? "?"}`)
    .join("\n");
}

export function buildLineProposalsPrompt(input: {
  supplierName: string;
  shipmentDescription: string;
  lines: readonly ProposalRequestLine[];
  examples: readonly ProposalExample[];
  /** Zatwierdzone pozycje innych dostawców — praktyka klasyfikacji Mikranu. */
  otherExamples?: readonly ProposalExample[];
}): string {
  const examples = formatExamples(input.examples, 40);
  const otherExamples = formatExamples(input.otherExamples ?? [], 30);
  const lines = input.lines
    .map(
      (l) =>
        `- ref=${l.ref} kod=${l.code || "?"} nazwa="${l.supplierName}"${l.invoiceGroup ? ` grupa na fakturze: "${l.invoiceGroup}"` : ""}${
          l.documentDescription ? ` (w deklaracji: "${l.documentDescription}")` : ""
        }${l.invoiceHsCode ? ` HS nadawcy: ${l.invoiceHsCode}` : ""}${
          l.knownDescriptionPl ? ` opis PL ustalony: "${l.knownDescriptionPl}"` : ""
        }`
    )
    .join("\n");
  return `Przygotowujesz dane do odprawy celnej importu do Polski dla firmy Mikran (protetyka stomatologiczna).
Dostawca: ${input.supplierName}. Przesyłka zawiera: ${input.shipmentDescription || "nieokreślone"}.

Dla każdej pozycji podaj:
- descriptionPl: krótki polski opis towaru dla agencji celnej (nazwa + istotne cechy, np. „Nożyk do wosku Lessman 17cm”),
- material: materiał wykonania (np. „stal nierdzewna”, „drewniana rękojeść, ostrze ze stali nierdzewnej”),
- cnCode: 8-cyfrowy kod Nomenklatury Scalonej UE (CN), aktualny,
- cnCertain: false, gdy towar da się sensownie zaklasyfikować w więcej niż jednej pozycji albo nazwa jest zbyt ogólna,
- cnReason: jedno krótkie zdanie, dlaczego ta pozycja CN (np. „łożysko kulkowe — uwaga 2(a) do sekcji XVI, 8482”).

Klasyfikuj według Ogólnych Reguł Interpretacji i uwag do sekcji / działów, na podstawie nazwy z faktury
(ustalony opis PL bywa ogólny — kod dobieraj do towaru opisanego na fakturze):
1. Kompletny instrument / urządzenie — według tego, czym jest (np. prostnica do mikrosilnika protetycznego,
   jak w zatwierdzonych pozycjach dostawcy).
2. Części, które same są towarem wymienionym w konkretnej pozycji, klasyfikuj do tej pozycji
   (uwaga 2(a) do działu 90 i do sekcji XVI): łożyska kulkowe 8482, przewody elektryczne z wtykami 8544 42,
   silniki elektryczne 8501, części silników elektrycznych (twornik, uzwojenie, obudowa silnika) 8503,
   uchwyty narzędziowe i tuleje zaciskowe (collet) 8466 10.
3. Części ogólnego zastosowania z metali nieszlachetnych (podkładki, pierścienie osadcze / zatrzaskowe, śruby,
   sprężyny) — dział 73 (7318, 7320), nie dział 84/85/90: zwykła podkładka 7318 22 00, podkładka sprężysta
   lub falista (wave washer) 7318 21 00, pierścień osadczy / zatrzaskowy (snap ring, circlip) 7318 29 00.
   Tuleja (bushing) to nie podkładka — łożysko ślizgowe 8483 30 albo część instrumentu (pkt 4). Takie same wyroby (podkładki, pierścienie)
   z tworzyw sztucznych — 3926. Element z tworzywa dopasowany tylko do jednego instrumentu — jak w pkt 4.
4. Pozostałe części przeznaczone wyłącznie lub głównie do jednego instrumentu / urządzenia
   (przód prostnicy, wrzeciono, mechanizm, nasadka) — razem z tym instrumentem, tym samym kodem co on
   (uwaga 2(b) do działu 90 / sekcji XVI).
5. Zmontowane płytki elektroniczne (PCB ASS'Y) — oznacz cnCertain: false, bo zależą od urządzenia, do którego należą.
6. Praktyka Mikranu: frezy i wiertła do frezarek CAD/CAM do cyrkonu, PMMA, wosku, kompozytu (materiały inne
   niż metal) to 8207 70 90; do frezowania metalu (tytan, CoCr) — 8207 70 10 / 31 / 37 wg materiału części roboczej.
   9018 49 10 dotyczy tylko wierteł do wiertarek dentystycznych.
   Drukarki 3D to maszyny do wytwarzania przyrostowego — pozycja 8485 (od 2022), nie 8443.
Słownik nazw z faktur: „car needle” / „bur” / „burs” (chiń. 车针) = frez / wiertło, „handpiece” = prostnica
(lub kątnica — „contra-angle”), „collet chuck” = tuleja zaciskowa, „cord ass'y” = przewód z wtykami,
„bobbin” / „armature” = uzwojenie / twornik silnika, „nose tip” = nasadka, „PCB ass'y” = płytka elektroniczna.
Trzymaj się stylu i kodów z zatwierdzonych wcześniej pozycji tego dostawcy, jeśli są podobne.
„HS nadawcy” to kod wpisany przez dostawcę — traktuj go jako wskazówkę, nie przepisuj bez sprawdzenia.
Gdy pozycja ma „opis PL ustalony”, zwróć go bez zmian w descriptionPl i dobierz materiał oraz kod CN.
Kod CN musi mieć 8 cyfr i jest wymagany dla każdej pozycji.
Pozycje o tym samym opisie PL i tym samym rodzaju towaru dostają ten sam kod CN i materiał — bądź spójny w całej liście.
Materiał pisz małymi literami, krótko (np. „stal”, „stal nierdzewna”, „tworzywo sztuczne”).
Nie oceniaj stawki VAT ani statusu wyrobu medycznego — to wynika z dokumentów dostawcy.

Zatwierdzone wcześniej pozycje tego dostawcy:
${examples || "(brak)"}

Zatwierdzone pozycje innych dostawców (te same zasady klasyfikacji):
${otherExamples || "(brak)"}

Pozycje do opisania:
${lines}`;
}

// ─── Weryfikacja kodu CN względem słownika ────────────────────────────────

export const CN_VERIFY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          ref: { type: Type.STRING },
          cnCode: { type: Type.STRING, description: "Jeden kod z listy kandydatów albo pusty" },
          cnCertain: { type: Type.BOOLEAN },
          cnReason: { type: Type.STRING },
        },
        required: ["ref", "cnCode", "cnCertain", "cnReason"],
      },
    },
  },
  required: ["items"],
} as const;

export type CnVerifyItem = {
  ref: string;
  supplierName: string;
  descriptionPl: string;
  material: string;
  proposedCnCode: string | null;
  candidates: readonly { code: string; text: string }[];
};

/**
 * Drugi krok: wybór kodu wyłącznie spośród istniejących kodów CN z oficjalnymi opisami
 * (np. łożysko kulkowe ≤ 30 mm średnicy zewnętrznej → 8482 10 10, a nie 10 90).
 */
export function buildCnVerifyPrompt(items: readonly CnVerifyItem[]): string {
  const blocks = items
    .map((i) =>
      [
        `ref=${i.ref} towar z faktury: "${i.supplierName}" — opis PL: "${i.descriptionPl}", materiał: "${i.material}", wstępny kod: ${i.proposedCnCode ?? "?"}`,
        ...i.candidates.map((c) => `  ${c.code} — ${c.text}`),
      ].join("\n")
    )
    .join("\n\n");
  return `Weryfikujesz kody Nomenklatury Scalonej (CN) dla odprawy importowej. Przy każdym towarze jest lista
istniejących kodów 8-cyfrowych z oficjalnymi opisami. Wybierz dokładnie jeden kod z tej listy, który najlepiej
opisuje towar (zwróć uwagę na wymiary, materiał części roboczej, napięcie, przeznaczenie). Nie podawaj kodu spoza listy.
Gdy żaden kod z listy nie pasuje (zła pozycja), zwróć pusty cnCode i cnCertain: false.
Wskazówki: oznaczenia łożysk miniaturowych zaczynają się od średnicy zewnętrznej w mm (1260zz → 12 mm,
1050zz → 10 mm, 840zz → 8 mm, R188 → 12,7 mm) — łożyska do prostnic i mikrosilników mają ≤ 30 mm.
Frezy do frezarek dentystycznych (cyrkon, PMMA, wosk) frezują materiały inne niż metal.
Pierścień zatrzaskowy / osadczy to nie podkładka sprężysta.
cnCertain: false także wtedy, gdy wybór zależy od cechy, której nie widać w nazwie (np. średnica łożyska) —
wtedy wybierz najbardziej prawdopodobny kod dla typowego towaru tego rodzaju i napisz w cnReason, co sprawdzić.
cnReason — jedno krótkie zdanie po polsku.

${blocks}`;
}

export type CnVerifyResult = { ref: string; cnCode: string | null; cnCertain: boolean; cnReason: string };

/** Tylko kody z listy kandydatów danej pozycji; brak odpowiedzi = brak wyniku dla ref. */
export function parseCnVerify(raw: unknown, allowed: ReadonlyMap<string, ReadonlySet<string>>): CnVerifyResult[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out: CnVerifyResult[] = [];
  const seen = new Set<string>();
  for (const item of asArray(obj.items)) {
    const ref = str(item.ref);
    const options = allowed.get(ref);
    if (!options || seen.has(ref)) continue;
    seen.add(ref);
    const code = normalizeCnCode(str(item.cnCode));
    const valid = code != null && options.has(code);
    out.push({
      ref,
      cnCode: valid ? code : null,
      cnCertain: valid && item.cnCertain !== false,
      cnReason: str(item.cnReason).slice(0, 160),
    });
  }
  return out;
}

/** „Stal nierdzewna” → „stal nierdzewna”; skróty („PMMA”, „ABS”) zostają. */
function lowerFirst(s: string): string {
  return /^\p{Lu}\p{Ll}/u.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s;
}

export type LineProposal = {
  ref: string;
  descriptionPl: string;
  material: string;
  cnCode: string | null;
  /** false = AI ma wątpliwości — do pokazania użytkownikowi. */
  cnCertain?: boolean;
  cnReason?: string;
};

export function parseLineProposals(raw: unknown, refs: ReadonlySet<string>): LineProposal[] {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const out: LineProposal[] = [];
  for (const item of asArray(obj.items)) {
    const ref = str(item.ref);
    const descriptionPl = str(item.descriptionPl).slice(0, 500);
    if (!refs.has(ref) || seen.has(ref) || !descriptionPl) continue;
    seen.add(ref);
    out.push({
      ref,
      descriptionPl,
      material: lowerFirst(str(item.material)).slice(0, 300),
      cnCode: normalizeCnCode(str(item.cnCode)),
      ...(item.cnCertain === false ? { cnCertain: false } : {}),
      ...(str(item.cnReason) ? { cnReason: str(item.cnReason).slice(0, 160) } : {}),
    });
  }
  return out;
}
