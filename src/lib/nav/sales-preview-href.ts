import { shouldApplyAdminSalesPreviewHeader, type AdminPanelContext } from "@/lib/auth/admin-panel-context";
import { isAdmin } from "@/lib/auth-roles";
import type { UserRole } from "@/types/database";

const SALES_PREVIEW_PATHS = ["/moje", "/prosba", "/plan", "/tablica", "/notatnik", "/zk"];

function isSalesPreviewPath(href: string): boolean {
  const hashIndex = href.indexOf("#");
  const pathAndQuery = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const qIndex = pathAndQuery.indexOf("?");
  const path = qIndex >= 0 ? pathAndQuery.slice(0, qIndex) : pathAndQuery;
  return SALES_PREVIEW_PATHS.includes(path);
}

/** Czy menu admina ma doklejać ?dla= (tylko cookie „sales”, nie po powrocie do administracji). */
export function shouldPreserveAdminSalesPreviewInNav(
  realRole: UserRole | null | undefined,
  panelContext: AdminPanelContext,
  previewDla: string | null | undefined
): boolean {
  return Boolean(
    realRole &&
      isAdmin(realRole) &&
      shouldApplyAdminSalesPreviewHeader(panelContext, previewDla)
  );
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
