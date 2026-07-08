import { GoogleGenAI, Type } from "@google/genai";
import {
  createTeethGroupDraft,
  groupTeethDetails,
  type TeethCatalogRef,
  type TeethGroupDraft,
  type TeethJaw,
  type TeethKind,
  type TeethLineDetail,
  type TeethProductLine,
} from "./teeth-catalog";
import { jawRequiredForKind } from "./teeth-mould-shape-groups";
import {
  buildTeethVisionPrompt,
  isValidOcrColor,
  isValidOcrMould,
  isValidOcrKind,
  isValidOcrJaw,
  isValidOcrProductLine,
  resolveOcrColor,
  resolveOcrMouldAndKind,
} from "./teeth-vision-prompt";

export type TeethVisionOcrGroup = TeethGroupDraft & {
  productLine: TeethProductLine;
};

export type TeethVisionOcrResult =
  | { ok: true; groups: TeethVisionOcrGroup[]; rawText: string; detectedProductLines: string[] }
  | { ok: false; error: string };

const MAX_OCR_ITEMS = 500;
const MAX_OCR_COUNT = 200;
const GEMINI_TIMEOUT_MS = 240_000;
const GEMINI_MAX_OUTPUT_TOKENS = 16384;
const GEMINI_RETRY_DELAYS_MS = [3000, 6000, 12000] as const;

/** Kolejność prób — przy 503 przechodzimy na kolejny model. */
const DEFAULT_GEMINI_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

const OCR_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productLine: { type: Type.STRING },
          color: { type: Type.STRING },
          mould: { type: Type.STRING, nullable: true },
          jaw: { type: Type.STRING, nullable: true },
          kind: { type: Type.STRING },
          count: { type: Type.INTEGER },
        },
        required: ["productLine", "color", "kind", "count"],
      },
    },
    note: { type: Type.STRING },
  },
  required: ["items"],
} as const;

function geminiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/** Limit dzienny / brak billing — retry innych modeli nie pomoże (ten sam projekt GCP). */
export function isGeminiQuotaExceeded(error: unknown): boolean {
  const msg = geminiErrorMessage(error);
  if (/exceeded your current quota|quota exceeded|check your plan and billing/i.test(msg)) {
    return true;
  }
  if (/free_tier|FreeTier/i.test(msg) && /limit:\s*0\b/i.test(msg)) {
    return true;
  }
  return false;
}

export const GEMINI_QUOTA_EXCEEDED_USER_MESSAGE =
  "Wyczerpano limit darmowego API Google Gemini. Włącz płatności (Billing) w Google AI Studio, spróbuj ponownie jutro albo wpisz zęby ręcznie.";

export function isRetryableGeminiError(error: unknown): boolean {
  if (!error || isGeminiQuotaExceeded(error)) return false;
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;
  if (status === 503) return true;
  if (status === 429) return true;
  const msg = geminiErrorMessage(error);
  if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) return true;
  if (/429|RESOURCE_EXHAUSTED/i.test(msg) && !isGeminiQuotaExceeded(error)) return true;
  return false;
}

export function geminiModelCandidates(): readonly string[] {
  const override = process.env.GOOGLE_AI_GEMINI_MODEL?.trim();
  if (!override) return DEFAULT_GEMINI_MODEL_CANDIDATES;
  const rest = DEFAULT_GEMINI_MODEL_CANDIDATES.filter((model) => model !== override);
  return [override, ...rest];
}

function geminiGenerateConfig(model: string) {
  const base = {
    responseMimeType: "application/json" as const,
    responseSchema: OCR_RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  };
  if (model.includes("2.5")) {
    return { ...base, thinkingConfig: { thinkingBudget: -1 } };
  }
  return base;
}

function userFacingGeminiError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return "Przekroczono czas oczekiwania na analizę zdjęcia. Spróbuj ponownie.";
  }
  if (isGeminiQuotaExceeded(error)) {
    return GEMINI_QUOTA_EXCEEDED_USER_MESSAGE;
  }
  if (isRetryableGeminiError(error)) {
    return "Serwer Google AI jest chwilowo przeciążony. Odczekaj minutę i spróbuj ponownie, albo wpisz pozycje ręcznie.";
  }
  return "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie lub wpisz pozycje ręcznie.";
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiWithRetries(
  genAI: GoogleGenAI,
  imageBase64: string,
  mimeType: string,
  prompt: string,
): Promise<{ text: string; model: string; elapsedMs: number }> {
  const startTime = Date.now();
  let lastError: unknown = null;

  for (const model of geminiModelCandidates()) {
    const maxAttempts = GEMINI_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delayMs = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 12_000;
        console.log(
          `[teeth-vision-ocr] Gemini retry ${attempt}/${maxAttempts - 1} on ${model} after ${delayMs}ms…`,
        );
        await sleep(delayMs);
      }

      try {
        const result = await withTimeout(
          genAI.models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { data: imageBase64, mimeType } },
                  { text: prompt },
                ],
              },
            ],
            config: geminiGenerateConfig(model),
          }),
          GEMINI_TIMEOUT_MS,
        );
        const text = result.text ?? "";
        return { text, model, elapsedMs: Date.now() - startTime };
      } catch (error) {
        lastError = error;
        if (isGeminiQuotaExceeded(error)) {
          console.warn("[teeth-vision-ocr] Gemini quota exceeded — stopping retries.");
          throw error;
        }
        const retryable = isRetryableGeminiError(error);
        console.warn(
          `[teeth-vision-ocr] Gemini ${model} attempt ${attempt + 1}/${maxAttempts} failed:`,
          error instanceof Error ? error.message : error,
        );
        if (!retryable) throw error;
      }
    }

    console.warn(`[teeth-vision-ocr] Gemini ${model} unavailable — trying fallback model…`);
  }

  throw lastError ?? new Error("Gemini unavailable");
}

let cachedGenAI: GoogleGenAI | null = null;
function getGenAI(apiKey: string): GoogleGenAI {
  if (!cachedGenAI) {
    cachedGenAI = new GoogleGenAI({ apiKey });
  }
  return cachedGenAI;
}

type RawOcrItem = {
  productLine?: unknown;
  color?: unknown;
  mould?: unknown;
  jaw?: unknown;
  kind?: unknown;
  count?: unknown;
};

type GeminiResponse = {
  items?: RawOcrItem[];
  note?: string;
};

export async function analyzeTeethImage(
  imageBase64: string,
  mimeType: string,
  catalog?: TeethCatalogRef,
): Promise<TeethVisionOcrResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Brak klucza API Google AI. Skontaktuj się z administratorem." };
  }

  const prompt = buildTeethVisionPrompt(catalog);

  let rawText: string;
  try {
    const genAI = getGenAI(apiKey);
    const gemini = await callGeminiWithRetries(genAI, imageBase64, mimeType, prompt);
    rawText = gemini.text;
    console.log(
      `[teeth-vision-ocr] Gemini ${gemini.model} responded in ${gemini.elapsedMs}ms`,
    );
  } catch (e) {
    console.error("[teeth-vision-ocr] Gemini API error:", e);
    return { ok: false, error: userFacingGeminiError(e) };
  }

  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(rawText) as GeminiResponse;
  } catch {
    console.error("[teeth-vision-ocr] Failed to parse JSON from Gemini:", rawText.slice(0, 500));
    return { ok: false, error: "Nie udało się odczytać danych ze zdjęcia. Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie." };
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  if (rawItems.length === 0) {
    const note = parsed.note ?? "Nie odczytano żadnych pozycji.";
    return { ok: false, error: `${note} Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie.` };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[teeth-vision-ocr] Gemini raw items (${rawItems.length}):`, JSON.stringify(rawItems));
  }

  type ValidDetail = TeethLineDetail & { productLine: TeethProductLine };
  const validDetails: ValidDetail[] = [];
  let rejectedCount = 0;

  for (const item of rawItems) {
    if (validDetails.length >= MAX_OCR_ITEMS) break;

    const productLineRaw = typeof item.productLine === "string" ? item.productLine.trim() : "";
    const colorRaw = typeof item.color === "string" ? item.color.trim() : "";
    const kindRaw = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
    const jawRaw = typeof item.jaw === "string" ? item.jaw.trim().toLowerCase() : null;
    const mouldRaw = typeof item.mould === "string" ? item.mould.trim() : null;

    if (!colorRaw) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: missing color`, JSON.stringify(item));
      continue;
    }

    if (!isValidOcrProductLine(productLineRaw)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad productLine`, JSON.stringify(item));
      continue;
    }
    let productLine = productLineRaw as TeethProductLine;

    if (!isValidOcrKind(kindRaw)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad kind`, JSON.stringify(item));
      continue;
    }
    let kind = kindRaw as TeethKind;

    let resolvedMould = mouldRaw;
    if (mouldRaw && mouldRaw.length > 0) {
      const resolved = resolveOcrMouldAndKind(productLine, mouldRaw, kind);
      if (resolved) {
        kind = resolved.kind;
        resolvedMould = resolved.mould;
        if (resolved.productLine) productLine = resolved.productLine;
      }
    }

    const color = resolveOcrColor(colorRaw, productLine);
    if (!isValidOcrColor(color, productLine)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad color`, JSON.stringify(item), { colorRaw, resolvedColor: color, productLine });
      continue;
    }

    if (!isValidOcrJaw(jawRaw)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad jaw`, JSON.stringify(item));
      continue;
    }
    const rawJaw = (jawRaw === "upper" || jawRaw === "lower" ? jawRaw : null) as TeethJaw | null;
    const jaw = kind === "anterior" ? null : rawJaw;

    if (jawRequiredForKind(kind) && !jaw) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: jaw required for posterior but missing`, JSON.stringify(item), { resolvedKind: kind });
      continue;
    }

    if (!isValidOcrMould(resolvedMould, kind, productLine)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: mould not in catalog`, JSON.stringify(item), { resolvedMould, resolvedKind: kind });
      continue;
    }
    const mould = resolvedMould && resolvedMould.length > 0 ? resolvedMould : null;

    const countRawParsed =
      typeof item.count === "number" ? item.count : parseInt(String(item.count), 10);
    const count =
      Number.isFinite(countRawParsed) && countRawParsed > 0
        ? Math.max(1, Math.min(MAX_OCR_COUNT, Math.trunc(countRawParsed)))
        : 1;

    for (let i = 0; i < count; i++) {
      validDetails.push({
        position: validDetails.length + 1,
        color,
        mould,
        jaw,
        kind,
        productLine,
      });
      if (validDetails.length >= MAX_OCR_ITEMS) break;
    }
  }

  if (validDetails.length === 0) {
    if (rejectedCount > 0) {
      console.warn(`[teeth-vision-ocr] All ${rejectedCount} items rejected — no valid details.`);
    }
    return {
      ok: false,
      error: `Nie udało się odczytać żadnej prawidłowej pozycji ze zdjęcia${rejectedCount > 0 ? ` (odrzucono ${rejectedCount} nieprawidłowych)` : ""}. Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie.`,
    };
  }

  if (rejectedCount > 0) {
    console.warn(`[teeth-vision-ocr] ${rejectedCount} item(s) rejected, ${validDetails.length} valid.`);
  }

  const detectedProductLines = [...new Set(validDetails.map((d) => d.productLine))];

  const finalGroups: TeethVisionOcrGroup[] = [];
  for (const pl of detectedProductLines) {
    const detailsForLine = validDetails.filter((d) => d.productLine === pl);
    const grouped = groupTeethDetails(detailsForLine);
    for (let i = 0; i < grouped.length; i++) {
      const draft = createTeethGroupDraft({ ...grouped[i], id: `tg-ocr-${pl}-${i}` });
      finalGroups.push({ ...draft, productLine: pl });
    }
  }

  return { ok: true, groups: finalGroups, rawText, detectedProductLines };
}

class TimeoutError extends Error {
  constructor() {
    super("Operation timed out");
    this.name = "TimeoutError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
