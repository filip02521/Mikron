import { mojeSectionDomId } from "@/lib/orders/moje-section-focus";

export const MOJE_ANNOUNCEMENTS_SECTION_ID = mojeSectionDomId("announcements");

export const MOJE_ANNOUNCEMENT_FOCUS_PARAM = "ogloszenie";

export function salesMojeAnnouncementHref(
  threadId: string,
  opts?: { previewDla?: string | null }
): string {
  const params = new URLSearchParams();
  params.set(MOJE_ANNOUNCEMENT_FOCUS_PARAM, threadId);
  if (opts?.previewDla) params.set("dla", opts.previewDla);
  return `/moje?${params.toString()}`;
}

export function salesMojeAnnouncementsListHref(opts?: { previewDla?: string | null }): string {
  const params = new URLSearchParams();
  if (opts?.previewDla) params.set("dla", opts.previewDla);
  const qs = params.toString();
  const hash = MOJE_ANNOUNCEMENTS_SECTION_ID;
  return qs ? `/moje?${qs}#${hash}` : `/moje#${hash}`;
}
