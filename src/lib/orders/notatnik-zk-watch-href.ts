import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { buildNotatnikZkWatchHref } from "@/lib/orders/zk-prosba-link-display";

/** Link do karty ZK w notatniku — z zachowaniem podglądu ?dla=. */
export function notatnikZkWatchHref(
  zkWatchId: string | null | undefined,
  options?: {
    salesPersonId?: string | null;
    previewDla?: string | null;
    archived?: boolean;
  }
): string | null {
  const watchId = zkWatchId?.trim();
  if (!watchId) return null;

  const previewDla = options?.previewDla?.trim() || null;
  const base = buildNotatnikZkWatchHref({
    zkWatchId: watchId,
    salesPersonId: options?.salesPersonId?.trim() || undefined,
    preview: Boolean(previewDla),
    archived: options?.archived,
  });
  return hrefWithSalesPreviewFromUrl(base, previewDla);
}
