const SALES_PREVIEW_PATHS = ["/moje", "/prosba", "/plan", "/tablica", "/notatnik"];

function isSalesPreviewPath(href: string): boolean {
  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const qIndex = pathAndQuery.indexOf("?");
  const path = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
  return SALES_PREVIEW_PATHS.includes(path);
}

/** Zachowuje ?dla= w linkach menu podczas podglądu handlowca przez administratora. */
export function hrefWithAdminSalesPreview(
  href: string,
  previewDla: string | null,
  enabled: boolean
): string {
  if (!enabled || !previewDla || !isSalesPreviewPath(href)) return href;

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const qIndex = pathAndQuery.indexOf("?");
  const path = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
  const params = new URLSearchParams(qIndex >= 0 ? pathAndQuery.slice(qIndex + 1) : "");
  params.set("dla", previewDla);
  return `${path}?${params.toString()}${hash}`;
}

/** Zachowuje ?dla= z bieżącego URL (podgląd admina / delegacja kierownika). */
export function hrefWithSalesPreviewFromUrl(href: string, previewDla: string | null): string {
  return hrefWithAdminSalesPreview(href, previewDla, Boolean(previewDla));
}
