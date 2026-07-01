import type { IndividualOrderTeethDetail } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { orderHasTeethSpec } from "@/lib/teeth/teeth-panel-filters";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";

export const TEETH_MARK_ORDERED_BLOCKED_MESSAGE =
  "Uzupełnij kompletną listę zębów przed oznaczeniem zamówienia u dostawcy.";

export type TeethMarkOrderedAnalysis = {
  orderIds: string[];
  withSpecIds: string[];
  withoutSpecIds: string[];
  hasMissingSpec: boolean;
  canMarkAny: boolean;
};

export function analyzeTeethMarkOrdered(
  orderIds: string[],
  ordersById: Map<
    string,
    {
      teeth_details?: IndividualOrderTeethDetail[] | null | undefined;
      products?: string;
      quantity?: string;
      subiekt_tw_id?: number | null;
    }
  >,
  ctx?: TeethPanelReadinessContext,
): TeethMarkOrderedAnalysis {
  const withSpecIds: string[] = [];
  const withoutSpecIds: string[] = [];

  for (const id of orderIds) {
    const order = ordersById.get(id);
    if (!order) continue;
    if (orderHasTeethSpec(order, ctx)) {
      withSpecIds.push(id);
    } else {
      withoutSpecIds.push(id);
    }
  }

  return {
    orderIds: [...withSpecIds, ...withoutSpecIds],
    withSpecIds,
    withoutSpecIds,
    hasMissingSpec: withoutSpecIds.length > 0,
    canMarkAny: withSpecIds.length > 0,
  };
}

export function teethMarkOrderedConfirmMessage(
  analysis: TeethMarkOrderedAnalysis,
  supplierName?: string | null
): string {
  const ready = analysis.withSpecIds.length;
  const skipped = analysis.withoutSpecIds.length;

  if (!analysis.canMarkAny) {
    return (
      `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE}\n\n` +
      `Użyj „Edytuj listę” przy każdej pozycji — kolor, fason, szczęka i typ muszą być kompletne.`
    );
  }

  const prefix =
    supplierName != null
      ? `Oznaczyć ${ready} ${plPozycja(ready)} u dostawcy ${supplierName} jako zamówione?`
      : ready === 1
        ? "Czy na pewno chcesz oznaczyć 1 pozycję jako zamówioną u dostawcy?"
        : `Czy na pewno chcesz oznaczyć ${ready} ${plPozycja(ready)} jako zamówione u dostawcy?`;

  if (!analysis.hasMissingSpec) {
    return prefix;
  }

  return (
    `${prefix}\n\n` +
    `${skipped} ${skipped === 1 ? "pozycja nie ma" : "pozycji nie ma"} kompletnej listy zębów — ` +
    `pominę ${skipped === 1 ? "ją" : "je"} i oznaczę tylko gotowe. Uzupełnij listę u pozostałych przed kolejnym zamówieniem.`
  );
}

export function teethMarkOrderedConfirmLabel(analysis: TeethMarkOrderedAnalysis): string {
  if (!analysis.canMarkAny) {
    return "Zamknij";
  }
  return "Oznacz jako zamówione";
}
