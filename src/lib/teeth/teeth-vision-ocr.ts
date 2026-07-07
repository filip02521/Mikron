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
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 240_000;
const GEMINI_MAX_OUTPUT_TOKENS = 16384;

let cachedGenAI: GoogleGenAI | null = null;
function getGenAI(apiKey: string): GoogleGenAI {
  if (!cachedGenAI) {
    cachedGenAI = new GoogleGenAI({ apiKey });
  }
  return cachedGenAI;
}

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

    const callGemini = () =>
      withTimeout(
        genAI.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            { role: "user", parts: [
              { inlineData: { data: imageBase64, mimeType } },
              { text: prompt },
            ] },
          ],
          config: {
            responseMimeType: "application/json",
            responseSchema: OCR_RESPONSE_SCHEMA,
            temperature: 0.1,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: -1 },
          },
        }),
        GEMINI_TIMEOUT_MS,
      );

    const startTime = Date.now();
    let result;
    try {
      result = await callGemini();
    } catch (e1) {
      const msg = e1 instanceof Error ? e1.message : String(e1);
      if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) {
        console.log("[teeth-vision-ocr] Gemini 503 — retrying after 3s…");
        await new Promise((r) => setTimeout(r, 3000));
        result = await callGemini();
      } else {
        throw e1;
      }
    }
    console.log(`[teeth-vision-ocr] Gemini responded in ${Date.now() - startTime}ms`);

    rawText = result.text ?? "";
  } catch (e) {
    if (e instanceof TimeoutError) {
      return { ok: false, error: "Przekroczono czas oczekiwania na analizę zdjęcia. Spróbuj ponownie." };
    }
    console.error("[teeth-vision-ocr] Gemini API error:", e);
    return { ok: false, error: "Nie udało się przeanalizować zdjęcia. Spróbuj ponownie lub wpisz pozycje ręcznie." };
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
    const countRaw = typeof item.count === "number" ? item.count : parseInt(String(item.count), 10);

    if (!isValidOcrProductLine(productLineRaw)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad productLine`, JSON.stringify(item));
      continue;
    }
    const productLine = productLineRaw as TeethProductLine;

    if (!isValidOcrKind(kindRaw)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad kind`, JSON.stringify(item));
      continue;
    }
    let kind = kindRaw as TeethKind;

    const color = resolveOcrColor(colorRaw, productLine);
    if (!isValidOcrColor(color, productLine)) {
      rejectedCount++;
      console.warn(`[teeth-vision-ocr] rejected: bad color`, JSON.stringify(item));
      continue;
    }

    let resolvedMould = mouldRaw;
    if (mouldRaw && mouldRaw.length > 0) {
      const resolved = resolveOcrMouldAndKind(productLine, mouldRaw, kind);
      if (resolved) {
        kind = resolved.kind;
        resolvedMould = resolved.mould;
      }
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

    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(MAX_OCR_COUNT, Math.trunc(countRaw))) : 1;

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
