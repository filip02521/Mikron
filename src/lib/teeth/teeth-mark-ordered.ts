import type { IndividualOrderTeethDetail } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";
import { orderHasTeethSpec } from "@/lib/teeth/teeth-panel-filters";
import type { TeethPanelReadinessContext } from "@/lib/teeth/teeth-panel-order-readiness";

export const TEETH_MARK_ORDERED_BLOCKED_MESSAGE =
  "Uzupełnij kompletną listę zębów przed oznaczeniem zamówienia u dostawcy.";

export const TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE =
  "Załącz jeden plik zamówienia (Excel, PDF lub XML) na grupę dostawcy — zanim oznaczysz jako zamówione.";

/** Gdy w Storage jest ścieżka, a w bazie brakuje oryginalnej nazwy. */
export const TEETH_GROUP_ORDER_FILE_FALLBACK_NAME = "plik zamówienia";

export type TeethMarkOrderedOrderInput = {
  teeth_details?: IndividualOrderTeethDetail[] | null | undefined;
  products?: string;
  quantity?: string;
  subiekt_tw_id?: number | null;
  supplier_id?: string | null;
  teeth_order_file_path?: string | null;
  teeth_order_file_name?: string | null;
};

export type TeethMarkOrderedAnalysis = {
  orderIds: string[];
  withSpecIds: string[];
  withoutSpecIds: string[];
  withoutFileIds: string[];
  /** Ile grup dostawcy w zaznaczeniu nie ma jeszcze pliku. */
  withoutFileGroupCount: number;
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

/** Klucz grupy pliku = dostawca z kolejki (Ivoclar = jeden plik na wszystkie prośby). */
export function teethOrderFileGroupKey(order: {
  supplier_id?: string | null;
}): string {
  const id = String(order.supplier_id ?? "").trim();
  return id || "__no_supplier";
}

/** Grupy dostawcy, w których choć jedna oczekująca prośba ma plik. */
export function teethSupplierGroupsWithOrderFile(
  orders: Iterable<TeethMarkOrderedOrderInput>
): Set<string> {
  const keys = new Set<string>();
  for (const order of orders) {
    if (orderHasTeethOrderFile(order)) {
      keys.add(teethOrderFileGroupKey(order));
    }
  }
  return keys;
}

export function resolveTeethGroupOrderFile(
  items: readonly TeethMarkOrderedOrderInput[]
): { hasFile: boolean; fileName: string | null } {
  for (const item of items) {
    if (orderHasTeethOrderFile(item)) {
      const name = item.teeth_order_file_name?.trim();
      return { hasFile: true, fileName: name || TEETH_GROUP_ORDER_FILE_FALLBACK_NAME };
    }
  }
  return { hasFile: false, fileName: null };
}

export function analyzeTeethMarkOrdered(
  orderIds: string[],
  ordersById: Map<string, TeethMarkOrderedOrderInput>,
  ctx?: TeethPanelReadinessContext,
): TeethMarkOrderedAnalysis {
  const withSpecIds: string[] = [];
  const withoutSpecIds: string[] = [];
  const withoutFileIds: string[] = [];
  const groupsWithFile = teethSupplierGroupsWithOrderFile(ordersById.values());

  for (const id of orderIds) {
    const order = ordersById.get(id);
    if (!order) continue;
    if (!orderHasTeethSpec(order, ctx)) {
      withoutSpecIds.push(id);
      continue;
    }
    if (!groupsWithFile.has(teethOrderFileGroupKey(order))) {
      withoutFileIds.push(id);
      continue;
    }
    withSpecIds.push(id);
  }

  const withoutFileGroupKeys = new Set<string>();
  for (const id of withoutFileIds) {
    const order = ordersById.get(id);
    if (order) withoutFileGroupKeys.add(teethOrderFileGroupKey(order));
  }

  return {
    orderIds: [...withSpecIds, ...withoutFileIds, ...withoutSpecIds],
    withSpecIds,
    withoutSpecIds,
    withoutFileIds,
    withoutFileGroupCount: withoutFileGroupKeys.size,
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
  const skippedFileGroups = analysis.hasMissingFile
    ? Math.max(1, analysis.withoutFileGroupCount)
    : analysis.withoutFileGroupCount;

  if (!analysis.canMarkAny) {
    if (analysis.hasMissingFile && analysis.hasMissingSpec) {
      return (
        `${TEETH_MARK_ORDERED_BLOCKED_MESSAGE}\n\n` +
        `Dodatkowo brakuje pliku zamówienia przy ${skippedFileGroups} ${
          skippedFileGroups === 1 ? "grupie dostawcy" : "grupach dostawcy"
        }.`
      );
    }
    if (analysis.hasMissingFile) {
      return (
        `${TEETH_MARK_ORDERED_FILE_REQUIRED_MESSAGE}\n\n` +
        `Jeden plik pokrywa wszystkie prośby u tego dostawcy — wrzuć go przy grupie, wtedy odblokuje się oznaczanie.`
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
      `${skippedFileGroups} ${
        skippedFileGroups === 1 ? "grupa dostawcy nie ma" : "grup dostawcy nie ma"
      } pliku zamówienia — ` +
        `pominę te prośby do czasu wrzucenia jednego pliku przy grupie.`
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
