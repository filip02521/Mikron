import { parseDateOnly } from "@/lib/orders/dates";
import { parseSubiektDocDate } from "@/lib/subiekt/zk-document";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** Termin realizacji z nagłówka dokumentu ZD (pierwsze dostępne pole). */
export function parseZdFulfillmentDeadline(
  doc: Pick<
    SubiektDocument,
    "dok_TerminRealizacji" | "dok_DataRealizacji" | "dok_Termin"
  >
): string | null {
  const raw =
    doc.dok_TerminRealizacji ?? doc.dok_DataRealizacji ?? doc.dok_Termin ?? null;
  const sliced = parseSubiektDocDate(raw);
  if (!sliced) return null;
  return parseDateOnly(sliced) ? sliced : null;
}
