"use client";

import { useMemo } from "react";
import { useActiveTeethShortages } from "@/components/layout/TeethShortagesContext";
import { supportsDualKindBuilder } from "@/lib/teeth/teeth-dual-kind";
import { useTeethProductInfo } from "@/components/layout/TeethExemptContext";
import type { TeethLineDetail, TeethProductLine } from "@/lib/teeth/teeth-catalog";
import {
  matchTeethShortagesForOrderLine,
  teethShortageFormWarning,
} from "@/lib/teeth/teeth-shortage-ui";
import type { FormMessage } from "@/lib/ui/notice-copy";
import type { TeethShortageMatchHit } from "@/lib/teeth/teeth-shortage-match";

/** Minimalny kształt linii — bez wymuszania pełnego ProductLineDraft. */
export type TeethShortageLineInput = {
  teethProductLine?: TeethProductLine | null;
  teethDetails?: TeethLineDetail[] | null;
};

export function useTeethShortageWarningForLines(
  lines: TeethShortageLineInput[],
  supplierId?: string | null,
): { hits: TeethShortageMatchHit[]; warningMessage: FormMessage | null } {
  const shortages = useActiveTeethShortages();
  const { registryIndex } = useTeethProductInfo();

  return useMemo(() => {
    if (shortages.length === 0) {
      return { hits: [], warningMessage: null };
    }
    const hits: TeethShortageMatchHit[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const productLine = line.teethProductLine ?? null;
      if (!productLine || !line.teethDetails?.length) continue;
      const dualKindMode = supportsDualKindBuilder(registryIndex, productLine);
      const lineHits = matchTeethShortagesForOrderLine({
        productLine,
        details: line.teethDetails,
        shortages,
        supplierId,
        dualKindMode,
      });
      for (const hit of lineHits) {
        if (seen.has(hit.shortage.id)) {
          const existing = hits.find((h) => h.shortage.id === hit.shortage.id);
          if (existing) existing.count += hit.count;
          continue;
        }
        seen.add(hit.shortage.id);
        hits.push({ ...hit });
      }
    }
    return { hits, warningMessage: teethShortageFormWarning(hits) };
  }, [lines, supplierId, shortages, registryIndex]);
}
