import { Type } from "@google/genai";
import { TEETH_LINE_DEFINITIONS } from "./teeth-lines-data";
import type { TeethProductLine } from "./teeth-catalog-types";
import { isTeethProductLine } from "./teeth-catalog";
import { callGeminiWithRetries, getGenAI, userFacingGeminiError } from "./teeth-vision-gemini";

export type DetectedLine = {
  productLine: TeethProductLine;
  confidence: number;
  note?: string;
};

export type TeethLineDetectionResult =
  | { ok: true; lines: DetectedLine[]; rawText: string }
  | { ok: false; error: string };

const DETECT_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    lines: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productLine: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          note: { type: Type.STRING },
        },
        required: ["productLine", "confidence"],
      },
    },
  },
  required: ["lines"],
} as const;

function buildDetectPrompt(): string {
  const parts: string[] = [];

  parts.push(
    `Jesteś asystentem rozpoznającym linie produktów zębowych na odręcznie wypełnionej kartce zamówienia.`,
  );
  parts.push(
    `Twoim zadaniem jest TYLKO rozpoznanie, które linie produktów są obecne na kartce. NIE odczytuj szczegółów (fasonów, kolorów, ilości).`,
  );

  parts.push(`\n## Dostępne linie produktów i ich sygnały rozpoznawcze:`);

  const signals: Record<string, string> = {
    wiedent_classic: "Fasony 3-4 cyfrowe (402, 421, 635, 733), kolory A1-D3, nazwa 'Classic'; prefix 'W' na kartce",
    wiedent_almamiss: "Fasony 3-cyfrowe (210, 320, 650, 790), kolory A1-D4 + OM, nazwa 'Almamiss'; prefix 'W' na kartce",
    wiedent_estetic: "Fasony 2-cyfrowe (12-50, 60-80), kolory A1-B3 + G/N/R (skala W), nazwa 'Estetic'; prefix 'W' na kartce",
    wiedent_estetic_vita: "Te same fasony co Estetic, ale kolory VITA (A1-D4), 'wg Vity'; prefix 'W' na kartce",
    wiedent_estetic_om: "Kolory OM1/OM3/0M1/0M3, 'wybielone', fasony 06/08/010/27/33/36/38/48; prefix 'W' na kartce",
    ivoclar_ivostar: "Kolory Chromascop (XXX/YY) lub VITA, fasony 2-cyfrowe (01-45), 'Ivostar'; prefix 'ivo' na kartce",
    ivoclar_gnathostar: "Fasony D80-D88 (lub same liczby 80-88), 'Gnathostar'; prefix 'ivo' na kartce, często z Ivostar",
    ivoclar_phonares_ii: "Fasony S*/B*/L* (przody), NU/NL/LU/LL (boki), kolory VITA+BL, 'Phonares'",
    ivoclar_vivodent_dcl: "Fasony A1*-A6* + A3-A10 (dolne), 'Vivodent'",
    ivoclar_orthotyp_dcl: "Fasony N*U/N*L/LU*/LL* (boki), 'Orthotyp' — często z Vivodent",
    major_super_lux: "Prefiksy 0/1, fasony 0/3-0/11, 50-62, 1/xx, 70N-79N, 'Super Lux'; prefix 'M' na kartce",
    major_composite: "Fasony B/L/M/S + A/T, 'kompozytowe'; prefix 'M' na kartce",
    major_dent: "Fasony 2-cyfrowe + litery (7A, 19A), kolory VITA + 2C-3R, 'Major DENT'; prefix 'M' na kartce",
    dentex_amberlux: "Fasony 0-48 (przody), I-X (boki rzymskie), kolory A1-R5, 'AmberLux'",
    dentex_amberlux_v: "Te same fasony, kolory z sufiksem V (A1V-D4V), 'skala V'",
    schottlander_enigmalife: "Fasony D/IR/IS/IT/K/L/S/P, 'Enigma'",
    hansen_generic: "Brak fasonów, tylko kolor + typ + szczęka, 'Hansen'",
    mgm_generic: "Brak fasonów, tylko kolor + typ + szczęka, 'MGM'",
    formed_generic: "Brak fasonów, tylko kolor + typ + szczęka, 'Formed'",
  };

  for (const def of TEETH_LINE_DEFINITIONS) {
    const signal = signals[def.id] ?? "";
    parts.push(`\n- ${def.id} (${def.label}): ${signal}`);
  }

  parts.push(`\n## Reguły:`);
  parts.push(`1. Zwróć WSZYSTKIE linie widoczne na kartce. Kartka może zawierać sekcje Ivostar, Wiedent, Major i innych jednocześnie — nie zatrzymuj się na pierwszej.`);
  parts.push(`2. Jeśli nie pewien — zwróć z confidence < 0.5.`);
  parts.push(`3. Pary linii: Ivostar+Gnathostar i Vivodent+Orthotyp często występują razem (przody + boki = osobne towary).`);
  parts.push(`4. Rozróżnij linie po KOLORACH i FASONACH:`);
  parts.push(`   - Ivostar Chromascop: kolory z cyfrą i literą (01, 1A, 2A, 2B, 1C, 2C, 3C, 3E, 4A, 4B, 4C, 4D, 6B, 6C, 6D) oraz VITA, fasony 01-45 (przody) i 80-88 (boki).`);
  parts.push(`   - Wiedent Estetic (skala W): kolory G/N/R (G1, G2, G3, N2, N3, N5, R1, R3, R5) + A1-B3, fasony 2-cyfrowe (12-50, 00-011, 60-80).`);
  parts.push(`   - Wiedent Classic/Almamiss: kolory A1-D4 + OM, fasony Classic 3-4 cyfrowe (402, 421, 635, 733) lub Almamiss 3-cyfrowe (210, 320, 650, 790).`);
  parts.push(`   - Major Super Lux: kolory A1-D4 + 2C-3R, fasony "0/8", "1/60", "70N-79N".`);
  parts.push(`   - Major Composite: kolory A1-D4, fasony B/L/M/S/A/T.`);
  parts.push(`   - Dentex AmberLux: kolory A1-R5 (bez sufiksa), fasony 0-48 lub I-X.`);
  parts.push(`   - Dentex AmberLux skala V: kolory z sufiksem V (A1V-D4V).`);
  parts.push(`5. Linie z prefixem "ivo" to Ivoclar; prefix "W" to Wiedent; prefix "M" to Major. Prefix jest najsilniejszym sygnałem, ale zweryfikuj kolor/fasony.`);
  parts.push(`6. Ignoruj przedrukowany tekst (nagłówki, logo) — rozpoznaj tylko ODRĘCZNE wpisy.`);
  parts.push(`7. Skreślone pozycje pomiń — rozpoznaj linie na podstawie nieprzekreślonych wpisów.`);
  parts.push(`8. confidence: 0.0-1.0, gdzie 1.0 = absolutna pewność, 0.5 = prawdopodobne.`);
  parts.push(`\n## Format odpowiedzi:`);
  parts.push(`Zwróć JSON z tablicą "lines", gdzie każdy element ma: productLine (dokładnie jedno z ID powyżej), confidence (liczba 0-1), note (opcjonalny komentarz).`);

  return parts.join("\n");
}

type DetectResponse = {
  lines?: Array<{ productLine?: unknown; confidence?: unknown; note?: unknown }>;
};

export async function analyzeTeethImageForLines(
  imageBase64: string,
  mimeType: string,
): Promise<TeethLineDetectionResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "Brak klucza API Google AI. Skontaktuj się z administratorem." };
  }

  const prompt = buildDetectPrompt();

  let rawText: string;
  try {
    const genAI = getGenAI(apiKey);
    const gemini = await callGeminiWithRetries(
      genAI,
      imageBase64,
      mimeType,
      prompt,
      DETECT_RESPONSE_SCHEMA,
    );
    rawText = gemini.text;
    console.debug(
      `[teeth-vision-detect] Gemini ${gemini.model} responded in ${gemini.elapsedMs}ms`,
    );
  } catch (e) {
    console.error("[teeth-vision-detect] Gemini API error:", e);
    return { ok: false, error: userFacingGeminiError(e) };
  }

  let parsed: DetectResponse;
  try {
    parsed = JSON.parse(rawText) as DetectResponse;
  } catch {
    console.error("[teeth-vision-detect] Failed to parse JSON:", rawText.slice(0, 500));
    return { ok: false, error: "Nie udało się rozpoznać linii na zdjęciu. Spróbuj zrobić lepsze zdjęcie lub wybierz linię ręcznie." };
  }

  const rawLines = Array.isArray(parsed.lines) ? parsed.lines : [];
  const detected: DetectedLine[] = [];

  for (const raw of rawLines) {
    const plRaw = typeof raw.productLine === "string" ? raw.productLine.trim() : "";
    if (!plRaw || !isTeethProductLine(plRaw)) continue;

    const confRaw = typeof raw.confidence === "number" ? raw.confidence : parseFloat(String(raw.confidence));
    const confidence = Number.isFinite(confRaw) ? Math.max(0, Math.min(1, confRaw)) : 0.5;

    const note = typeof raw.note === "string" ? raw.note.trim() : undefined;

    detected.push({ productLine: plRaw, confidence, note });
  }

  const unique = new Map<string, DetectedLine>();
  for (const d of detected) {
    const existing = unique.get(d.productLine);
    if (!existing || d.confidence > existing.confidence) {
      unique.set(d.productLine, d);
    }
  }

  const lines = [...unique.values()].sort((a, b) => b.confidence - a.confidence);

  if (lines.length === 0) {
    console.warn("[teeth-vision-detect] No valid lines detected.");
  }

  return { ok: true, lines, rawText };
}
