const SALES_PREVIEW_PATHS = ["/moje", "/prosba", "/plan", "/tablica", "/notatnik"];

/** Zachowuje ?dla= w linkach menu podczas podglądu handlowca przez administratora. */
export function hrefWithAdminSalesPreview(
  href: string,
  previewDla: string | null,
  enabled: boolean
): string {
  if (!enabled || !previewDla) return href;
  if (!SALES_PREVIEW_PATHS.some((p) => href === p || href.startsWith(`${p}?`))) {
    return href;
  }
  const base = href.split("?")[0] ?? href;
  return `${base}?dla=${encodeURIComponent(previewDla)}`;
}
