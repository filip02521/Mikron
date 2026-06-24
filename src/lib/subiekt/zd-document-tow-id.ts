import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** API ZD po `id` (tw_Id) zwraca fałszywe trafienia — weryfikuj linię dokumentu. */
export function zdDocumentContainsTowId(
  doc: SubiektDocument,
  twId: number
): boolean {
  const target = Math.trunc(twId);
  if (!Number.isFinite(target) || target <= 0) return false;
  return (doc.dok_Pozycja ?? []).some((line) => lineTowId(line) === target);
}
