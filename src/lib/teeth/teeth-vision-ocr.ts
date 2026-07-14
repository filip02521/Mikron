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
  buildTeethVisionPromptForLine,
  isValidOcrColor,
  isValidOcrMould,
  isValidOcrKind,
  isValidOcrJaw,
  isValidOcrProductLine,
  resolveOcrColor,
  resolveOcrMouldAndKind,
} from "./teeth-vision-prompt";
import {
  callGeminiWithRetries,
  getGenAI,
  userFacingGeminiError,
} from "./teeth-vision-gemini";

export {
  isGeminiQuotaExceeded,
  isRetryableGeminiError,
  geminiModelCandidates,
  GEMINI_QUOTA_EXCEEDED_USER_MESSAGE,
} from "./teeth-vision-gemini";

export type TeethVisionOcrGroup = TeethGroupDraft & {
  productLine: TeethProductLine;
};

export type TeethVisionOcrResult =
  | { ok: true; groups: TeethVisionOcrGroup[]; rawText: string; detectedProductLines: string[] }
  | { ok: false; error: string };

const MAX_OCR_ITEMS = 500;
const MAX_OCR_COUNT = 200;

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
    console.debug(
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

export async function analyzeTeethImageForLine(
  imageBase64: string,
  mimeType: string,
  productLine: TeethProductLine,
): Promise<TeethVisionOcrResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Brak klucza API Google AI. Skontaktuj się z administratorem." };
  }

  const prompt = buildTeethVisionPromptForLine(productLine);

  let rawText: string;
  try {
    const genAI = getGenAI(apiKey);
    const gemini = await callGeminiWithRetries(genAI, imageBase64, mimeType, prompt);
    rawText = gemini.text;
    console.debug(
      `[teeth-vision-ocr] Gemini ${gemini.model} (per-line: ${productLine}) responded in ${gemini.elapsedMs}ms`,
    );
  } catch (e) {
    console.error(`[teeth-vision-ocr] Gemini API error (per-line: ${productLine}):`, e);
    return { ok: false, error: userFacingGeminiError(e) };
  }

  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(rawText) as GeminiResponse;
  } catch {
    console.error(`[teeth-vision-ocr] Failed to parse JSON from Gemini (per-line: ${productLine}):`, rawText.slice(0, 500));
    return { ok: false, error: "Nie udało się odczytać danych ze zdjęcia. Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie." };
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  if (rawItems.length === 0) {
    const note = parsed.note ?? "Nie odczytano żadnych pozycji.";
    return { ok: false, error: `${note} Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie.` };
  }

  if (process.env.NODE_ENV !== "production") {
    console.log(`[teeth-vision-ocr] Gemini raw items (per-line: ${productLine}, ${rawItems.length}):`, JSON.stringify(rawItems));
  }

  type ValidDetail = TeethLineDetail & { productLine: TeethProductLine };
  const validDetails: ValidDetail[] = [];
  let rejectedCount = 0;

  for (const item of rawItems) {
    if (validDetails.length >= MAX_OCR_ITEMS) break;

    const colorRaw = typeof item.color === "string" ? item.color.trim() : "";
    const kindRaw = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
    const jawRaw = typeof item.jaw === "string" ? item.jaw.trim().toLowerCase() : null;
    const mouldRaw = typeof item.mould === "string" ? item.mould.trim() : null;

    if (!colorRaw) {
      rejectedCount++;
      continue;
    }

    if (!isValidOcrKind(kindRaw)) {
      rejectedCount++;
      continue;
    }
    let kind = kindRaw as TeethKind;

    let resolvedMould = mouldRaw;
    if (mouldRaw && mouldRaw.length > 0) {
      const resolved = resolveOcrMouldAndKind(productLine, mouldRaw, kind);
      if (resolved) {
        kind = resolved.kind;
        resolvedMould = resolved.mould;
      }
    }

    const color = resolveOcrColor(colorRaw, productLine);
    if (!isValidOcrColor(color, productLine)) {
      rejectedCount++;
      continue;
    }

    if (!isValidOcrJaw(jawRaw)) {
      rejectedCount++;
      continue;
    }
    const rawJaw = (jawRaw === "upper" || jawRaw === "lower" ? jawRaw : null) as TeethJaw | null;
    const jaw = kind === "anterior" ? null : rawJaw;

    if (jawRequiredForKind(kind) && !jaw) {
      rejectedCount++;
      continue;
    }

    if (!isValidOcrMould(resolvedMould, kind, productLine)) {
      rejectedCount++;
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
      console.warn(`[teeth-vision-ocr] (per-line: ${productLine}) All ${rejectedCount} items rejected — no valid details.`);
    }
    return {
      ok: false,
      error: `Nie udało się odczytać żadnej prawidłowej pozycji ze zdjęcia${rejectedCount > 0 ? ` (odrzucono ${rejectedCount} nieprawidłowych)` : ""}. Spróbuj zrobić lepsze zdjęcie lub wpisz pozycje ręcznie.`,
    };
  }

  if (rejectedCount > 0) {
    console.warn(`[teeth-vision-ocr] (per-line: ${productLine}) ${rejectedCount} item(s) rejected, ${validDetails.length} valid.`);
  }

  const grouped = groupTeethDetails(validDetails);
  const finalGroups: TeethVisionOcrGroup[] = [];
  for (let i = 0; i < grouped.length; i++) {
    const draft = createTeethGroupDraft({ ...grouped[i], id: `tg-ocr-${productLine}-${i}` });
    finalGroups.push({ ...draft, productLine });
  }

  return { ok: true, groups: finalGroups, rawText, detectedProductLines: [productLine] };
}
