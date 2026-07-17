/** Normalizacja nazw firm do porównań (PL + typowe skróty). */

const LEGAL_FORM_PATTERNS: RegExp[] = [
  /\bspolka\s+z\s+ograniczona\s+odpowiedzialnoscia\b/gi,
  /\bspolka\s+komandytowa\b/gi,
  /\bspolka\s+jawna\b/gi,
  /\bspolka\s+partnerska\b/gi,
  /\bprzedsiebiorstwo\b/gi,
  /\bsp\.?\s*z\.?\s*o\.?\s*o\.?\b/gi,
  /\bsp\.?\s*k\.?\b/gi,
  /\bsp\.?\s*j\.?\b/gi,
  /\bsp\.?\s*p\.?\b/gi,
  /\bsp\.?\s*z\.?\s*o\.?\s*o\.?\s*sp\.?\s*k\.?\b/gi,
  /\bsp\.?\s*z\.?\s*o\.?\s*o\.?\s*sp\.?\s*j\.?\b/gi,
  /\bs\.?\s*a\.?\b/gi,
  /\bllc\b/gi,
  /\bgmbh\b/gi,
  /\binc\.?\b/gi,
  /\bltd\.?\b/gi,
  /\bco\.?\b/gi,
];

function baseNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[„"']/g, "")
    .replace(/[.,()[\]{}]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Usuwa formę prawną i znaki pomocnicze. */
export function stripCompanyLegalForm(name: string): string {
  let s = baseNormalize(name);
  for (const re of LEGAL_FORM_PATTERNS) {
    s = s.replace(re, " ");
  }
  return s.replace(/\s+/g, " ").trim();
}

/** Tokeny znaczące (min. 2 znaki) po oczyszczeniu. */
export function companyNameTokens(name: string): string[] {
  const core = stripCompanyLegalForm(name);
  if (!core) return [];
  return [...new Set(core.split(" ").filter((t) => t.length >= 2))];
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Etykieta kontrahenta z Subiekta (często „SYMBOL — Nazwa”, nie mylić z łącznikiem w nazwie). */
export function kontrahentLabelForMatch(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "";
  const symbolSep = trimmed.match(/^(.{1,24})\s+[—–]\s+(.+)$/);
  if (symbolSep?.[2]?.trim()) return symbolSep[2].trim();
  return trimmed;
}

export type CompanyNameMatchResult = {
  score: number;
  reason: string;
};

/**
 * Ocena podobieństwa nazw (0–100).
 * Cel: wychwycić tę samą firmę po zmianie sp. k. → sp. z o.o. itp.
 */
export function scoreCompanyNameMatch(
  kontrahentLabel: string,
  supplierName: string
): CompanyNameMatchResult {
  const kRaw = kontrahentLabelForMatch(kontrahentLabel);
  const sRaw = supplierName.trim();
  if (!kRaw || !sRaw) return { score: 0, reason: "" };

  const kCore = stripCompanyLegalForm(kRaw);
  const sCore = stripCompanyLegalForm(sRaw);
  if (!kCore || !sCore) return { score: 0, reason: "" };

  if (kCore === sCore) {
    return { score: 100, reason: "Ta sama nazwa po usunięciu formy prawnej" };
  }

  if (kCore.includes(sCore) || sCore.includes(kCore)) {
    const ratio = Math.min(kCore.length, sCore.length) / Math.max(kCore.length, sCore.length);
    const score = Math.round(72 + ratio * 26);
    return {
      score,
      reason: ratio > 0.75 ? "Jedna nazwa zawiera drugą" : "Częściowe pokrycie nazwy",
    };
  }

  const kTokens = companyNameTokens(kRaw);
  const sTokens = companyNameTokens(sRaw);
  const jaccard = jaccardSimilarity(kTokens, sTokens);
  if (jaccard >= 0.5) {
    const shared = kTokens.filter((t) => sTokens.includes(t));
    const score = Math.round(55 + jaccard * 40);
    return {
      score,
      reason:
        shared.length > 0
          ? `Wspólne słowa: ${shared.slice(0, 4).join(", ")}`
          : "Podobny zestaw słów w nazwie",
    };
  }

  const kFirst = kTokens[0];
  const sFirst = sTokens[0];
  if (kFirst && sFirst && kFirst.length >= 4 && kFirst === sFirst) {
    return { score: 62, reason: `Ta sama główna nazwa („${kFirst}")` };
  }

  for (const t of sTokens) {
    if (t.length >= 4 && kCore.includes(t)) {
      return {
        score: 78,
        reason: `Nazwa dostawcy „${t}" występuje w kontrahencie Subiekt`,
      };
    }
  }

  return { score: 0, reason: "" };
}
