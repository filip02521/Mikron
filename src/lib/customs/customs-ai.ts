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
import { normalizeArticleCode, normalizeCnCode } from "./customs-clearance";
import { parseLooseNumber, type CustomsInputLine } from "./customs-lines";

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
    currency: { type: Type.STRING, description: "ISO 4217, np. EUR, USD" },
    total: { type: Type.NUMBER, nullable: true },
    hsCode: { type: Type.STRING, nullable: true },
    countryOfOrigin: { type: Type.STRING, nullable: true },
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING, description: "Numer artykułu dostawcy, np. DE-1196" },
          name: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unitPrice: { type: Type.NUMBER, nullable: true },
        },
        required: ["code", "name", "quantity"],
      },
    },
  },
  required: ["invoiceNumber", "lines"],
} as const;

export const INVOICE_EXTRACTION_PROMPT = `Odczytaj fakturę handlową dostawcy (może być skanem).
Zwróć numer faktury, datę (YYYY-MM-DD), walutę, kwotę całkowitą, kod HS z faktury (jeśli jest) i kraj pochodzenia.
Dla każdej pozycji tabeli: numer artykułu dostawcy (kolumna kod / art. no / item no), nazwę dokładnie jak na fakturze, ilość i cenę jednostkową.
Nie pomijaj pozycji. Nie zgaduj — puste pole, gdy wartości nie widać. Nie tłumacz nazw.`;

export type InvoiceExtraction = {
  invoiceNumber: string;
  invoiceDate: string | null;
  currency: string | null;
  total: number | null;
  hsCode: string | null;
  countryOfOrigin: string | null;
  lines: CustomsInputLine[];
};

export function parseInvoiceExtraction(raw: unknown): InvoiceExtraction {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const date = str(obj.invoiceDate);
  const currency = str(obj.currency).toUpperCase();
  const lines = asArray(obj.lines)
    .map((l) => ({
      supplierArticleCode: normalizeArticleCode(str(l.code)),
      supplierName: str(l.name),
      quantity: parseLooseNumber(str(l.quantity)) ?? 0,
      unitPrice: parseLooseNumber(str(l.unitPrice)),
      subiektTwId: null,
    }))
    .filter((l) => (l.supplierArticleCode || l.supplierName) && l.quantity > 0);
  return {
    invoiceNumber: str(obj.invoiceNumber).slice(0, 120),
    invoiceDate: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    total: parseLooseNumber(str(obj.total)),
    hsCode: str(obj.hsCode) || null,
    countryOfOrigin: str(obj.countryOfOrigin) || null,
    lines,
  };
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
      ].join("\t")
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
        },
        required: ["ref", "descriptionPl", "material", "cnCode"],
      },
    },
  },
  required: ["items"],
} as const;

export type ProposalExample = { supplierName: string; descriptionPl: string; material: string; cnCode: string | null };
export type ProposalRequestLine = { ref: string; code: string; supplierName: string; documentDescription?: string };

export function buildLineProposalsPrompt(input: {
  supplierName: string;
  shipmentDescription: string;
  lines: readonly ProposalRequestLine[];
  examples: readonly ProposalExample[];
}): string {
  const examples = input.examples
    .slice(0, 40)
    .map((e) => `- "${e.supplierName}" → opis: "${e.descriptionPl}", materiał: "${e.material}", CN: ${e.cnCode ?? "?"}`)
    .join("\n");
  const lines = input.lines
    .map(
      (l) =>
        `- ref=${l.ref} kod=${l.code || "?"} nazwa="${l.supplierName}"${
          l.documentDescription ? ` (w deklaracji: "${l.documentDescription}")` : ""
        }`
    )
    .join("\n");
  return `Przygotowujesz dane do odprawy celnej importu do Polski dla firmy Mikran (protetyka stomatologiczna).
Dostawca: ${input.supplierName}. Przesyłka zawiera: ${input.shipmentDescription || "nieokreślone"}.

Dla każdej pozycji podaj:
- descriptionPl: krótki polski opis towaru dla agencji celnej (nazwa + istotne cechy, np. „Nożyk do wosku Lessman 17cm”),
- material: materiał wykonania (np. „stal nierdzewna”, „drewniana rękojeść, ostrze ze stali nierdzewnej”),
- cnCode: 8-cyfrowy kod Nomenklatury Scalonej (CN) najbardziej prawdopodobny dla towaru.
Trzymaj się stylu i kodów z zatwierdzonych wcześniej pozycji tego dostawcy, jeśli są podobne.
Nie oceniaj stawki VAT ani statusu wyrobu medycznego — to wynika z dokumentów dostawcy.

Zatwierdzone wcześniej pozycje tego dostawcy:
${examples || "(brak)"}

Pozycje do opisania:
${lines}`;
}

export type LineProposal = { ref: string; descriptionPl: string; material: string; cnCode: string | null };

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
      material: str(item.material).slice(0, 300),
      cnCode: normalizeCnCode(str(item.cnCode)),
    });
  }
  return out;
}
