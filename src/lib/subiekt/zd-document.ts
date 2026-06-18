/** Normalizacja numeru ZD (zamówienie do dostawcy) z wpisu magazyniera. */

export const MIN_ZD_QUERY_LENGTH = 2;

export function normalizeZdQuery(input: string): string {
  return input
    .trim()
    .replace(/^zd\s*[:#]?\s*\/?/i, "")
    .trim();
}

/** Klucz porównawczy numeru ZD (bez spacji, lowercase, bez prefiksu ZD). */
export function normalizeZdNumberKey(value: string): string {
  return normalizeZdQuery(value).replace(/\s+/g, "").toLowerCase();
}

export function zdNumbersEquivalent(a: string, b: string): boolean {
  return normalizeZdNumberKey(a) === normalizeZdNumberKey(b);
}

export type ZdQueryValidation =
  | { ok: true; normalized: string }
  | { ok: false; message: string };

export function validateZdQueryForSubmit(input: string): ZdQueryValidation {
  const normalized = normalizeZdQuery(input);
  if (!normalized) {
    return {
      ok: false,
      message: "Podaj numer ZD, np. ZD/123/2026.",
    };
  }
  if (normalized.replace(/\s+/g, "").length < MIN_ZD_QUERY_LENGTH) {
    return { ok: false, message: "Wpisz co najmniej 2 znaki numeru ZD." };
  }
  return { ok: true, normalized };
}

/** Pełny numer ZD (np. 123/2026) — można od razu rozstrzygnąć bez listy wyboru. */
export function isFullZdNumberQuery(query: string): boolean {
  const compact = normalizeZdQuery(query).replace(/\s+/g, "");
  return /^\d+\/\d{4}$/.test(compact);
}

/** Krótki kod (np. 81) — zawsze wymaga wyboru z listy. */
export function isPartialZdNumberQuery(query: string): boolean {
  return !isFullZdNumberQuery(query);
}

/** Lista po krótkim kodzie — tylko ostatnie 6 miesięcy. */
export const ZD_RECEIVE_PARTIAL_SEARCH_MONTHS = 6;

/** Pełny numer — szukaj do 2 lat wstecz. */
export const ZD_RECEIVE_FULL_SEARCH_MONTHS = 24;

export function zdReceiveSearchMonthsBack(query: string): number {
  return isFullZdNumberQuery(query)
    ? ZD_RECEIVE_FULL_SEARCH_MONTHS
    : ZD_RECEIVE_PARTIAL_SEARCH_MONTHS;
}

export type ZdSearchCandidate = {
  dokId: number;
  docNumber: string;
  /** ISO data wystawienia — do sortowania listy wyników. */
  issuedAt?: string | null;
};

export type ZdReceiveSearchCandidate = ZdSearchCandidate & {
  supplierLabel: string | null;
  issuedAt: string | null;
};

/** Etykieta numeru ZD bez prefiksu (do listy wyboru). */
export function formatZdDocNumberLabel(docNumber: string): string {
  const normalized = normalizeZdQuery(docNumber);
  return normalized || docNumber.trim();
}

export function zdReceiveSearchChooseHint(query: string, count: number): string {
  const label = query.trim() || "wpisany kod";
  if (count === 1) {
    return `Kod „${label}” pasuje do jednego ZD — potwierdź wybór z listy.`;
  }
  return `Kod „${label}” pasuje do ${count} dokumentów ZD — wybierz właściwy z listy.`;
}

/** Najświeższe ZD na górze listy wyboru. */
export function sortZdReceiveCandidatesByIssuedAtDesc(
  candidates: ZdReceiveSearchCandidate[]
): ZdReceiveSearchCandidate[] {
  return [...candidates].sort((a, b) => {
    const da = a.issuedAt ?? "";
    const db = b.issuedAt ?? "";
    return db.localeCompare(da) || b.dokId - a.dokId;
  });
}

export function pickZdCandidateFromSearch(
  query: string,
  candidates: ZdSearchCandidate[]
): ZdSearchCandidate | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const key = normalizeZdNumberKey(query);
  const exact = candidates.filter((item) => zdNumbersEquivalent(item.docNumber, query));
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;

  const byKey = candidates.filter((item) => normalizeZdNumberKey(item.docNumber) === key);
  if (byKey.length === 1) return byKey[0]!;

  return null;
}

export function zdSearchAmbiguityMessage(candidates: ZdSearchCandidate[]): string {
  const preview = candidates
    .slice(0, 3)
    .map((item) => item.docNumber)
    .join(", ");
  const suffix = candidates.length > 3 ? ` i ${candidates.length - 3} innych` : "";
  return `Znaleziono wiele ZD (${preview}${suffix}). Wpisz pełny numer dokumentu.`;
}
