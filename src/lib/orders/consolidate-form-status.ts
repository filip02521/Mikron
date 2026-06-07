import type { SubiektFeedback, SubiektErrorCode } from "@/lib/subiekt/feedback";

const SUBIEKT_UNAVAILABLE_CODES = new Set<SubiektErrorCode>([
  "not_configured",
  "unreachable",
  "network",
  "timeout",
  "subiekt_unavailable",
  "sql_not_configured",
  "health_degraded",
]);

const SUBIEKT_SEARCH_NOISE_CODES = new Set<SubiektErrorCode>([
  "not_found_product",
  "not_found_supplier",
  "not_found_app_supplier",
  "short_query",
  "empty_query",
]);

export function dedupeSubiektFeedbacks(items: SubiektFeedback[]): SubiektFeedback[] {
  const seen = new Set<string>();
  const out: SubiektFeedback[] = [];
  for (const f of items) {
    const key = `${f.code}:${f.title}:${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function isSubiektUnavailableFeedback(feedback: SubiektFeedback): boolean {
  return SUBIEKT_UNAVAILABLE_CODES.has(feedback.code);
}

/** Gdy Subiekt jest niedostępny, ukryj wtórne komunikaty wyszukiwania (szum). */
export function consolidateSubiektFeedbacks(items: SubiektFeedback[]): SubiektFeedback[] {
  const deduped = dedupeSubiektFeedbacks(items);
  const unavailable = deduped.find(isSubiektUnavailableFeedback);
  if (!unavailable) return deduped;

  const filtered = deduped.filter((f) => {
    if (f === unavailable) return true;
    if (SUBIEKT_SEARCH_NOISE_CODES.has(f.code) && f.tone !== "error") return false;
    return true;
  });

  return filtered.length ? filtered : [unavailable];
}

function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[„"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Łączy message i hint bez powtórzeń — jeden akapit w UI. */
export function subiektFeedbackBody(feedback: SubiektFeedback): string {
  const message = feedback.message.trim();
  const hint = feedback.hint?.trim();
  if (!hint) return message;

  const msgNorm = normalizeForCompare(message);
  const hintNorm = normalizeForCompare(hint);
  if (msgNorm.includes(hintNorm) || hintNorm.includes(msgNorm)) return message;

  const msgTokens = new Set(msgNorm.split(" ").filter(Boolean));
  const hintTokens = hintNorm.split(" ").filter(Boolean);
  if (hintTokens.length > 0) {
    const overlap = hintTokens.filter((t) => msgTokens.has(t)).length / hintTokens.length;
    if (overlap >= 0.55) return message;
  }

  return `${message} ${hint}`;
}
