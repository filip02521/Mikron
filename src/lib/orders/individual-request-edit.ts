import type { IndividualOrder, IndividualRequestKind } from "@/types/database";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import { hasAnyProductHint } from "@/lib/orders/request-completeness";
import { normalizeSalesRequestNote } from "@/lib/orders/sales-request-note";

/** Prośbę można edytować, dopóki dział dostaw jej nie złożył u dostawcy. */
export function isIndividualOrderEditable(order: IndividualOrder): boolean {
  if (order.ordered_at?.trim()) return false;
  if (order.status === "Anulowane") return false;
  /** Pełna rezygnacja zamknięta u handlowca — bez edycji. */
  if (order.sales_cancelled_at && order.sales_acknowledged_at) return false;
  return order.status === "Nowe" || order.status === "Weryfikacja";
}

export function canEditIndividualRequestGroup(orders: IndividualOrder[]): boolean {
  return orders.length > 0 && orders.every(isIndividualOrderEditable);
}

/** Id linii w zapisie edycji — tylko gdy należy do edytowanej prośby. */
export function resolveIndividualRequestEditLineId(
  lineId: string | undefined,
  orderIds: readonly string[]
): string | undefined {
  if (!lineId?.trim()) return undefined;
  return orderIds.includes(lineId) ? lineId : undefined;
}

type EditLineDraft = {
  id: string;
  symbol: string;
  mikranCode: string;
  product: string;
  quantity: string;
  clientName?: string;
  clientKhId?: number | null;
  subiektTwId?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
  source?: "subiekt" | "catalog" | null;
  requestNote?: string;
};

/**
 * Linie do zapisu edycji prośby.
 * - istniejące pozycje (id z orderIds) zawsze zostają — walidacja wyłapie puste,
 * - nowe puste wiersze z formularza (losowe id Reacta) są pomijane.
 */
export function filterIndividualRequestEditLinesForSave(
  lines: EditLineDraft[],
  orderIds: readonly string[],
  options?: { supplierId?: string }
): EditLineDraft[] {
  const supplierId = options?.supplierId ?? "";
  return lines.filter((line) => {
    if (resolveIndividualRequestEditLineId(line.id, orderIds)) return true;
    return hasAnyProductHint({
      supplierId,
      symbol: line.symbol,
      mikranCode: line.mikranCode,
      product: line.product,
    });
  });
}

export function toIndividualRequestEditLinePayload(
  line: EditLineDraft,
  orderIds: readonly string[]
): IndividualRequestEditLineInput {
  return {
    id: resolveIndividualRequestEditLineId(line.id, orderIds),
    symbol: line.symbol,
    mikranCode: line.mikranCode,
    product: line.product,
    quantity: line.quantity,
    clientName: line.clientName,
    clientKhId: line.clientKhId,
    subiektTwId: line.subiektTwId,
    onHand: line.onHand,
    reserved: line.reserved,
    available: line.available,
    stockSource: line.stockSource,
    source: line.source,
    requestNote: line.requestNote,
  };
}

export type IndividualRequestEditLineInput = {
  /** Istniejąca pozycja — brak id = nowa linia w tej samej prośbie. */
  id?: string;
  symbol?: string;
  mikranCode?: string;
  product?: string;
  quantity?: string;
  clientName?: string;
  clientKhId?: number | null;
  subiektTwId?: number | null;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
  source?: "subiekt" | "catalog" | null;
  requestNote?: string | null;
};

/** @deprecated Używaj `requestNote` na każdej linii w `lines`. */
export function editRequestNoteForSave(
  requestNote: string,
  options: { mixedOnLines: boolean; touched: boolean; initialNote?: string }
): string | null | undefined {
  const initial = options.initialNote ?? "";
  const trimmed = requestNote.trim();
  const initialTrimmed = initial.trim();

  if (options.mixedOnLines && !options.touched && !trimmed) return undefined;
  if (!options.touched && trimmed === initialTrimmed) return undefined;

  return requestNote;
}

export type IndividualRequestEditPayload = {
  supplierId: string;
  salesPersonId: string;
  requestKind: IndividualRequestKind;
  /** Tylko przy `requestKind === "informacja"` — ścieżka magazyn / panel / brak na stanie. */
  informacjaPath?: InformacjaFlowPath;
  /**
   * Wspólna notatka dla wszystkich pozycji w prośbie.
   * `undefined` — nie zmieniaj istniejących uwag (np. różne notatki na liniach).
   */
  requestNote?: string | null;
  lines: IndividualRequestEditLineInput[];
  /** Po dialogu „Wyślij mimo to” — serwer przepuszcza zapis mimo pełnego stanu magazynowego. */
  acknowledgeSufficientStock?: boolean;
};

export type AddIndividualOrdersEntry = {
  supplierId?: string;
  salesPersonId: string;
  symbol?: string;
  mikranCode?: string;
  product?: string;
  quantity?: string;
  requestKind?: IndividualRequestKind;
  clientName?: string;
  clientKhId?: number | null;
  requestNote?: string | null;
  subiektTwId?: number | null;
  source?: "subiekt" | "catalog" | null;
  sourceZkWatchId?: string | null;
  sourceZkNumber?: string | null;
  informacjaQueueViaDailyPanel?: boolean;
  informacjaStockOutReorder?: boolean;
  onHand?: number | null;
  reserved?: number | null;
  available?: number | null;
  stockSource?: "subiekt" | null;
};

export type AddIndividualOrdersInput = {
  entries: AddIndividualOrdersEntry[];
  acknowledgeSufficientStock?: boolean;
};

export function normalizeAddIndividualOrdersInput(
  input: AddIndividualOrdersInput | AddIndividualOrdersEntry[]
): AddIndividualOrdersInput {
  if (Array.isArray(input)) {
    return { entries: input, acknowledgeSufficientStock: undefined };
  }
  return input;
}

export function ordersToEditLines(orders: IndividualOrder[]): IndividualRequestEditLineInput[] {
  return orders.map((o) => ({
    id: o.id,
    symbol: o.symbol !== "-" ? o.symbol : "",
    mikranCode: o.mikran_code?.trim() ?? "",
    product: o.products !== "Do uzupełnienia" ? o.products : "",
    quantity: o.quantity !== "-" ? o.quantity : "",
    clientName: o.sales_client_name ?? "",
    clientKhId: o.sales_client_kh_id ?? null,
    subiektTwId: o.subiekt_tw_id ?? null,
    requestNote: normalizeSalesRequestNote(o.sales_request_note) ?? "",
  }));
}
