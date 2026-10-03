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
