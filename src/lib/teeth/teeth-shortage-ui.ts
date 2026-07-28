import type { TeethLineDetail, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import { catalogLineForDualKind } from "@/lib/teeth/teeth-dual-kind";
import {
  matchActiveTeethShortages,
  type TeethShortageMatchHit,
  type TeethShortageMatchInput,
} from "@/lib/teeth/teeth-shortage-match";
import { TEETH_SHORTAGE_BANNER_TITLE } from "@/lib/teeth/teeth-shortage-copy";
import { formWarning, type FormMessage } from "@/lib/ui/notice-copy";

export function matchTeethShortagesForOrderLine(input: {
  productLine?: TeethProductLine | null;
  details?: TeethLineDetail[] | null;
  shortages: TeethShortageMatchInput[];
  supplierId?: string | null;
  dualKindMode?: boolean;
}): TeethShortageMatchHit[] {
  const { productLine, details, shortages, supplierId, dualKindMode } = input;
  if (!productLine || !details?.length || shortages.length === 0) return [];

  if (!dualKindMode) {
    return matchActiveTeethShortages({
      productLine,
      details,
      shortages,
      supplierId,
    });
  }

  const anteriorLine = catalogLineForDualKind(productLine, "anterior");
  const posteriorLine = catalogLineForDualKind(productLine, "posterior");
  const anterior = details.filter((d) => d.kind !== "posterior");
  const posterior = details.filter((d) => d.kind === "posterior");

  const hits = [
    ...matchActiveTeethShortages({
      productLine: anteriorLine,
      details: anterior,
      shortages,
      supplierId,
    }),
    ...matchActiveTeethShortages({
      productLine: posteriorLine,
      details: posterior,
      shortages,
      supplierId,
    }),
  ];

  const byId = new Map<string, TeethShortageMatchHit>();
  for (const hit of hits) {
    const existing = byId.get(hit.shortage.id);
    if (existing) existing.count += hit.count;
    else byId.set(hit.shortage.id, { ...hit });
  }
  return Array.from(byId.values());
}

export function teethShortageFormWarning(hits: TeethShortageMatchHit[]): FormMessage | null {
  if (hits.length === 0) return null;
  const lines = hits
    .slice(0, 4)
    .map((h) => {
      const note = h.shortage.note?.trim();
      return note ? `${h.message} (${note})` : h.message;
    })
    .join(" · ");
  const extra = hits.length > 4 ? ` (+${hits.length - 4})` : "";
  return formWarning(
    TEETH_SHORTAGE_BANNER_TITLE,
    `${lines}${extra}. Wysyłka nie jest blokowana.`,
  );
}
