import { lineTowId } from "@/lib/subiekt/zd-catalog-import";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** API ZD po `id` (tw_Id) zwraca fałszywe trafienia — weryfikuj linię dokumentu. */
export function zdDocumentContainsTowId(
  doc: SubiektDocument,
  twId: number | readonly number[]
): boolean {
  const targets = new Set(
    (Array.isArray(twId) ? twId : [twId])
      .map((id) => Math.trunc(Number(id)))
      .filter((id) => Number.isFinite(id) && id > 0)
  );
  if (!targets.size) return false;
  return (doc.dok_Pozycja ?? []).some((line) => {
    const id = lineTowId(line);
    return id != null && targets.has(id);
  });
}
