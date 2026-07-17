import { GoogleGenAI, Type } from "@google/genai";

export const GEMINI_TIMEOUT_MS = 240_000;
export const GEMINI_MAX_OUTPUT_TOKENS = 16384;
export const GEMINI_RETRY_DELAYS_MS = [3000, 6000, 12000] as const;

/** Kolejność prób — przy 503 przechodzimy na kolejny model. */
const DEFAULT_GEMINI_MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
] as const;

export const OCR_RESPONSE_SCHEMA = {
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

export class TimeoutError extends Error {
  constructor() {
    super("Operation timed out");
    this.name = "TimeoutError";
  }
}

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
    typeof error === "object" && error != null
      ? Number((error as Record<string, unknown>).status)
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

export function geminiGenerateConfig(model: string, responseSchema?: object) {
  const base = {
    responseMimeType: "application/json" as const,
    responseSchema: responseSchema ?? OCR_RESPONSE_SCHEMA,
    temperature: 0.1,
    maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  };
  if (model.includes("2.5")) {
    return { ...base, thinkingConfig: { thinkingBudget: -1 } };
  }
  return base;
}

export function userFacingGeminiError(error: unknown): string {
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

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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

export async function callGeminiWithRetries(
  genAI: GoogleGenAI,
  imageBase64: string,
  mimeType: string,
  prompt: string,
  responseSchema?: object,
): Promise<{ text: string; model: string; elapsedMs: number }> {
  const startTime = Date.now();
  let lastError: unknown = null;

  for (const model of geminiModelCandidates()) {
    const maxAttempts = GEMINI_RETRY_DELAYS_MS.length + 1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        const delayMs = GEMINI_RETRY_DELAYS_MS[attempt - 1] ?? 12_000;
        console.warn(
          `[teeth-vision-gemini] Gemini retry ${attempt}/${maxAttempts - 1} on ${model} after ${delayMs}ms…`,
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
            config: geminiGenerateConfig(model, responseSchema),
          }),
          GEMINI_TIMEOUT_MS,
        );
        const text = result.text ?? "";
        return { text, model, elapsedMs: Date.now() - startTime };
      } catch (error) {
        lastError = error;
        if (isGeminiQuotaExceeded(error)) {
          console.warn("[teeth-vision-gemini] Gemini quota exceeded — stopping retries.");
          throw error;
        }
        const retryable = isRetryableGeminiError(error);
        console.warn(
          `[teeth-vision-gemini] Gemini ${model} attempt ${attempt + 1}/${maxAttempts} failed:`,
          error instanceof Error ? error.message : error,
        );
        if (!retryable) throw error;
      }
    }

    console.warn(`[teeth-vision-gemini] Gemini ${model} unavailable — trying fallback model…`);
  }

  throw lastError ?? new Error("Gemini unavailable");
}

let cachedGenAI: GoogleGenAI | null = null;
export function getGenAI(apiKey: string): GoogleGenAI {
  if (!cachedGenAI) {
    cachedGenAI = new GoogleGenAI({ apiKey });
  }
  return cachedGenAI;
}
