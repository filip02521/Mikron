/**
 * Które załączniki maila są „prawdziwe” (faktura, zdjęcie towaru), a które to obrazki z treści:
 * logo w podpisie, ikonki, obrazki wklejone przez Outlooka (image001.png). Te drugie zaśmiecają listę
 * i liczniki, a w przekazaniu dalej nie mają sensu. Nowe synchronizacje mają flagę `inline` z nagłówków
 * (Content-ID / Content-Disposition: inline); starsze wiadomości rozpoznajemy po nazwie i rozmiarze.
 */

import type { GmailAttachmentRef } from "@/lib/google/gmail";

/** Obraz, który przeglądarka pokaże w <img> (endpoint załącznika serwuje inline tylko te typy). */
export function isPreviewableImage(a: Pick<GmailAttachmentRef, "mimeType">): boolean {
  return /^image\/(png|jpe?g|gif|webp)$/i.test(a.mimeType);
}

const INLINE_NAME_RE =
  /^(image\d{3}\.|image\.(png|jpe?g|gif)$|outlook-|~wrd|oledata|pastedimage|att\d+\.(png|jpe?g|gif)$)|logo|signature|sygnatur|podpis|banner|icon|stopka|facebook|linkedin|instagram|youtube|twitter/i;
/** Logo w podpisie ma kilka–kilkadziesiąt KB; zdjęcie towaru z telefonu to setki KB. */
const INLINE_MAX_BYTES = 40_000;

export function isInlineImage(a: Pick<GmailAttachmentRef, "filename" | "mimeType" | "size" | "inline">): boolean {
  if (!/^image\//i.test(a.mimeType)) return false;
  return a.inline === true || INLINE_NAME_RE.test(a.filename) || (a.size ?? 0) < INLINE_MAX_BYTES;
}
