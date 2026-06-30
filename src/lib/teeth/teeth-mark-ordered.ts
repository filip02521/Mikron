import type { IndividualOrderTeethDetail } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { orderHasTeethSpec } from "@/lib/teeth/teeth-panel-filters";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";
export type TeethMarkOrderedAnalysis = {
  orderIds: string[];
  withSpecIds: string[];
  withoutSpecIds: string[];
  hasMissingSpec: boolean;
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
  };
}

export function teethMarkOrderedConfirmMessage(
  analysis: TeethMarkOrderedAnalysis,
  supplierName?: string | null
): string {
  const n = analysis.orderIds.length;
  const prefix =
    supplierName != null
      ? `Oznaczyć ${n} ${plPozycja(n)} u dostawcy ${supplierName} jako zamówione?`
      : n === 1
        ? "Czy na pewno chcesz oznaczyć 1 pozycję jako zamówioną u dostawcy?"
        : `Czy na pewno chcesz oznaczyć ${n} ${plPozycja(n)} jako zamówione u dostawcy?`;

  if (!analysis.hasMissingSpec) {
    return prefix;
  }

  const missing = analysis.withoutSpecIds.length;
  return (
    `${prefix}\n\n` +
    `Uwaga: ${missing} ${missing === 1 ? "pozycja nie ma" : "pozycji nie ma"} uzupełnionej listy zębów. ` +
    `Zamówienie u dostawcy bez pełnej specyfikacji może skończyć się błędnym towarem.\n\n` +
    `Uzupełnij listę (Edytuj listę) albo potwierdź świadome zamówienie mimo braków.`
  );
}

export function teethMarkOrderedConfirmLabel(analysis: TeethMarkOrderedAnalysis): string {
  if (analysis.hasMissingSpec) {
    return "Zamów mimo braków";
  }
  return "Oznacz jako zamówione";
}
