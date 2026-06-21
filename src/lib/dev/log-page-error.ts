/** Loguje błędy stron serwerowych tylko w dev — bez hałasu w produkcji. */
export function logDevPageError(context: string, error: unknown): void {
  if (process.env.NODE_ENV === "production") return;
  console.error(`[${context}]`, error instanceof Error ? error.stack ?? error.message : error);
}
