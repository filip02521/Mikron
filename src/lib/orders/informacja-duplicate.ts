import { isInformacjaRequest } from "@/lib/orders/individual";
import { isInformacjaStockOutReorder } from "@/lib/orders/informacja-stock-out-reorder";
import { normalizeMyOrderSearchText } from "@/lib/orders/my-order-search";
import {
  clientsMatchForSalesClient,
} from "@/lib/orders/sales-client-match";
import {
  normalizeSalesClientKhId,
  normalizeSalesClientName,
} from "@/lib/orders/sales-client-label";
import { isAwaitingInformacjaAck } from "@/lib/orders/sales-pickup";
import {
  isOpenProsbaOrder,
  type ZkLinkableOrder,
} from "@/lib/sales/zk-watch-order-link";
import type { IndividualOrder, IndividualRequestKind } from "@/types/database";

export type InformacjaDuplicateProductInput = {
  subiektTwId?: number | null;
  symbol?: string | null;
  mikranCode?: string | null;
  product?: string | null;
};

export type InformacjaDuplicateClientInput = {
  clientName?: string | null;
  clientKhId?: number | null;
};

export type InformacjaDuplicateCandidate = InformacjaDuplicateProductInput &
  InformacjaDuplicateClientInput & {
    salesPersonId: string;
  };

export type InformacjaDuplicateOrderLike = InformacjaDuplicateCandidate & {
  id?: string;
  request_kind?: IndividualRequestKind | null;
  status: string;
  sales_acknowledged_at?: string | null;
  sales_cancelled_at?: string | null;
  informacja_stock_out_reorder?: boolean | null;
};

function normalizeSubiektTwId(value: unknown): number | null {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeProductToken(value: string | null | undefined): string {
  return normalizeMyOrderSearchText(value ?? "");
}

export function informacjaProductsMatch(
  a: InformacjaDuplicateProductInput,
  b: InformacjaDuplicateProductInput
): boolean {
  const aTw = normalizeSubiektTwId(a.subiektTwId);
  const bTw = normalizeSubiektTwId(b.subiektTwId);
  if (aTw != null && bTw != null) return aTw === bTw;

  const aSym = normalizeProductToken(a.symbol);
  const bSym = normalizeProductToken(b.symbol);
  if (aSym && bSym && aSym === bSym) return true;

  const aMikran = normalizeProductToken(a.mikranCode);
  if (aMikran && bSym && aMikran === bSym) return true;

  const bMikran = normalizeProductToken(b.mikranCode);
  if (bMikran && aSym && bMikran === aSym) return true;
  if (aMikran && bMikran && aMikran === bMikran) return true;

  const aName = normalizeProductToken(a.product);
  const bName = normalizeProductToken(b.product);
  if (!aName || !bName) return false;
  return aName === bName;
}

export function informacjaClientsMatch(
  a: InformacjaDuplicateClientInput,
  b: InformacjaDuplicateClientInput
): boolean {
  const aName = normalizeSalesClientName(a.clientName);
  const bName = normalizeSalesClientName(b.clientName);
  const aKh = normalizeSalesClientKhId(aName, a.clientKhId);
  const bKh = normalizeSalesClientKhId(bName, b.clientKhId);

  if (!aName && !bName && aKh == null && bKh == null) return true;

  return clientsMatchForSalesClient(
    { client_kh_id: aKh, client_label: aName ?? "" },
    { sales_client_kh_id: bKh, sales_client_name: bName }
  );
}

export function isActiveInformacjaOrder(
  order: Pick<
    InformacjaDuplicateOrderLike,
    | "request_kind"
    | "status"
    | "sales_acknowledged_at"
    | "sales_cancelled_at"
    | "informacja_stock_out_reorder"
  >
): boolean {
  if (!isInformacjaRequest(order)) return false;
  if (order.status === "Anulowane") return false;

  if (isInformacjaStockOutReorder(order as IndividualOrder)) {
    return order.status === "Nowe" || order.status === "Weryfikacja";
  }

  if (isAwaitingInformacjaAck(order as IndividualOrder)) return true;

  return isOpenProsbaOrder(order as ZkLinkableOrder);
}

export function informacjaDuplicateProductLabel(
  order: InformacjaDuplicateProductInput
): string {
  const symbol = order.symbol?.trim();
  const product = order.product?.trim();
  if (symbol && product && symbol !== "-") return `${symbol} — ${product}`;
  return product || symbol || order.mikranCode?.trim() || "ten produkt";
}

export function formatInformacjaDuplicateMessage(
  existing: InformacjaDuplicateProductInput & InformacjaDuplicateClientInput,
  options?: { inBatch?: boolean }
): string {
  const productLabel = informacjaDuplicateProductLabel(existing);
  const clientName = normalizeSalesClientName(existing.clientName);
  const clientPart = clientName ? ` dla klienta „${clientName}”` : "";
  const scope = options?.inBatch ? " w tej samej prośbie" : " już na liście";
  return `Taka prośba informacyjna${clientPart} jest${scope}: ${productLabel}. Aktywna prośba o ten sam produkt już istnieje — nie dodawaj duplikatu.`;
}

export function findInformacjaDuplicate(
  candidate: InformacjaDuplicateCandidate,
  orders: InformacjaDuplicateOrderLike[],
  options?: { excludeIds?: Set<string> }
): InformacjaDuplicateOrderLike | null {
  for (const order of orders) {
    if (order.id && options?.excludeIds?.has(order.id)) continue;
    if (order.salesPersonId !== candidate.salesPersonId) continue;
    if (!isActiveInformacjaOrder(order)) continue;
    if (!informacjaClientsMatch(candidate, order)) continue;
    if (!informacjaProductsMatch(candidate, order)) continue;
    return order;
  }
  return null;
}

export function assertNoInformacjaDuplicatesInList(
  candidates: InformacjaDuplicateCandidate[],
  existing: InformacjaDuplicateOrderLike[],
  options?: { excludeIds?: string[] }
): void {
  if (!candidates.length) return;

  const excludeIds = new Set(options?.excludeIds ?? []);
  const seenInBatch: InformacjaDuplicateOrderLike[] = [];

  for (const candidate of candidates) {
    const duplicate = findInformacjaDuplicate(candidate, existing, { excludeIds });
    if (duplicate) {
      throw new Error(formatInformacjaDuplicateMessage(duplicate));
    }

    const batchDuplicate = findInformacjaDuplicate(candidate, seenInBatch);
    if (batchDuplicate) {
      throw new Error(formatInformacjaDuplicateMessage(candidate, { inBatch: true }));
    }

    seenInBatch.push({
      ...candidate,
      status: "Nowe",
      request_kind: "informacja",
      sales_acknowledged_at: null,
      sales_cancelled_at: null,
      informacja_stock_out_reorder: false,
    });
  }
}
