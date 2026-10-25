/** Escaping user input for PostgREST ilike patterns (% and _). */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Quote a scalar for a PostgREST `.or()` / `.and()` filter string.
 * Without quotes, commas/parens in the value split the filter list
 * (e.g. `col.ilike.%a,%` → tokens `col.ilike.%a` and `%`).
 */
export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** `%escaped%` already quoted for safe use inside `.or(...)`. */
export function buildQuotedIlikeContainsPattern(raw: string): string {
  return quotePostgrestFilterValue(`%${escapeIlikePattern(raw)}%`);
}

/**
 * Wyszukiwanie po słowach w SQL: jeden filtr `.or()` na słowo („eco gips” → eco w którejś kolumnie I gips w którejś).
 * Kolejne `.or()` na zapytaniu łączą się przez AND.
 */
export function buildWordsContainsOrFilters(raw: string, columns: readonly string[]): string[] {
  const words = [...new Set(raw.trim().split(/\s+/).filter(Boolean))];
  return words.map((w) => {
    const pattern = buildQuotedIlikeContainsPattern(w);
    return columns.map((c) => `${c}.ilike.${pattern}`).join(",");
  });
}
