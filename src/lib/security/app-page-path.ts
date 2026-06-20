const ALLOWED_PREFIXES = [
  "/moje",
  "/plan",
  "/prosba",
  "/notatnik",
  "/zk",
  "/tablica",
  "/podsumowanie",
  "/weryfikacja",
  "/kolejka",
  "/historia",
  "/zespol",
  "/admin",
  "/zakupy",
  "/login",
  "/ustaw-haslo",
] as const;

const MAX_LEN = 200;

/** Sanity check for client-reported page path in bug reports. */
export function normalizeSalesBugReportPagePath(raw: string): string {
  const trimmed = raw.trim().slice(0, MAX_LEN);
  if (!trimmed.startsWith("/")) return "/";
  if (trimmed.includes("://") || trimmed.includes("..")) return "/";
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) => trimmed === prefix || trimmed.startsWith(`${prefix}/`)
  );
  return allowed ? trimmed : "/";
}
