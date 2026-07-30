import type { IndividualOrderTeethDetail } from "@/types/database";
import { plPozycja, plProsba } from "@/lib/ui/polish-plurals";
import { orderHasTeethSpec } from "@/lib/teeth/teeth-panel-filters";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";

export const TEETH_MARK_ORDERED_BLOCKED_MESSAGE =
  "Uzupełnij kompletną listę zębów przed oznaczeniem zamówienia u dostawcy.";

export const TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE =
  "Załącz plik zamówienia (Excel, PDF lub XML) do każdej prośby przed oznaczeniem jako zamówione.";

export type TeethMarkOrderedOrderInput = {
  teeth_details?: IndividualOrderTeethDetail[] | null | undefined;
  products?: string;
  quantity?: string;
  subiekt_tw_id?: number | null;
  teeth_order_file_path?: string | null;
  teeth_order_file_name?: string | null;
};

export type TeethMarkOrderedAnalysis = {
  orderIds: string[];
  withSpecIds: string[];
  withoutSpecIds: string[];
  withoutFileIds: string[];
  hasMissingSpec: boolean;
  hasMissingFile: boolean;
  canMarkAny: boolean;
  selectedPositionCount?: number;
};

/** Plik jest kompletny tylko gdy jest ścieżka w Storage (da się pobrać). */
export function orderHasTeethOrderFile(order: {
  teeth_order_file_path?: string | null;
  teeth_order_file_name?: string | null;
}): boolean {
  return Boolean(order.teeth_order_file_path?.trim());
}

export function analyzeTeethMarkOrdered(
  orderIds: string[],
  ordersById: Map<string, TeethMarkOrderedOrderInput>,
  ctx?: TeethPanelReadinessContext,
): TeethMarkOrderedAnalysis {
  const withSpecIds: string[] = [];
  const withoutSpecIds: string[] = [];
  const withoutFileIds: string[] = [];

  for (const id of orderIds) {
    const order = ordersById.get(id);
    if (!order) continue;
    if (!orderHasTeethSpec(order, ctx)) {
      withoutSpecIds.push(id);
      continue;
    }
    if (!orderHasTeethOrderFile(order)) {
      withoutFileIds.push(id);
      continue;
    }
    withSpecIds.push(id);
  }

  return {
    orderIds: [...withSpecIds, ...withoutFileIds, ...withoutSpecIds],
    withSpecIds,
    withoutSpecIds,
    withoutFileIds,
    hasMissingSpec: withoutSpecIds.length > 0,
    hasMissingFile: withoutFileIds.length > 0,
    canMarkAny: withSpecIds.length > 0,
  };
}

export function teethMarkOrderedConfirmMessage(
  analysis: TeethMarkOrderedAnalysis,
  supplierName?: string | null
): string {
  const ready = analysis.selectedPositionCount ?? analysis.withSpecIds.length;
  const skippedOrders = analysis.withoutSpecIds.length;
  const skippedFiles = analysis.withoutFileIds.length;

  if (!analysis.canMarkAny) {
    if (analysis.hasMissingFile && analysis.hasMissingSpec) {
      return (
        `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE}\n\n` +
        `Dodatkowo brakuje pliku zamówienia przy ${skippedFiles} ${plProsba(skippedFiles)}.`
      );
    }
    if (analysis.hasMissingFile) {
      return (
        `${TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE}\n\n` +
        `Plik musi być załączony przy każdej prośbie — wtedy odblokuje się oznaczanie.`
      );
    }
    return (
      `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE}\n\n` +
      `Użyj „Edytuj listę” przy każdej pozycji — kolor, fason, szczęka i typ muszą być kompletne.`
    );
  }

  const prefix =
    supplierName != null
      ? `Oznaczyć ${ready} ${plPozycja(ready)} u dostawcy ${supplierName} jako zamówione?`
      : ready === 1
        ? "Czy na pewno chcesz oznaczyć 1 ząb jako zamówiony u dostawcy?"
        : `Czy na pewno chcesz oznaczyć ${ready} ${plPozycja(ready)} jako zamówione u dostawcy?`;

  const notes: string[] = [];
  if (analysis.hasMissingSpec) {
    notes.push(
      `${skippedOrders} ${skippedOrders === 1 ? "zamówienie nie ma" : "zamówień nie ma"} kompletnej listy zębów — ` +
        `pominę je i oznaczę tylko gotowe.`
    );
  }
  if (analysis.hasMissingFile) {
    notes.push(
      `${skippedFiles} ${plProsba(skippedFiles)} bez pliku zamówienia — ` +
        `pominę ${skippedFiles === 1 ? "ją" : "je"} do czasu załączenia pliku.`
    );
  }

  if (!notes.length) return prefix;
  return `${prefix}\n\n${notes.join("\n")}`;
}

export function teethMarkOrderedConfirmLabel(analysis: TeethMarkOrderedAnalysis): string {
  if (!analysis.canMarkAny) {
    return "Zamknij";
  }
  return "Oznacz jako zamówione";
}
