import { parseSubiektDocDate } from "@/lib/subiekt/zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** Termin realizacji z nagłówka dokumentu ZD (pierwsze dostępne pole). */
export function parseZdFulfillmentDeadline(
  doc: Pick<SubiektDocument, "dok_TerminRealizacji" | "dok_DataRealizacji">
): string | null {
  const raw = doc.dok_TerminRealizacji ?? doc.dok_DataRealizacji ?? null;
  return parseSubiektDocDate(raw);
}
