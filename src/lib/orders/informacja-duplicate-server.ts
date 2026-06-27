import type { SupabaseClient } from "@supabase/supabase-js";
import type { IndividualRequestKind } from "@/types/database";
import {
  assertNoInformacjaDuplicatesInList,
  isActiveInformacjaOrder,
  type InformacjaDuplicateCandidate,
  type InformacjaDuplicateOrderLike,
} from "@/lib/orders/informacja-duplicate";
import { resolveOrderLineSubiektTwIdFromCatalog } from "@/lib/orders/resolve-order-line-subiekt-tw-id";

const INFORMACJA_DUPLICATE_SELECT =
  "id, sales_person_id, sales_client_name, sales_client_kh_id, subiekt_tw_id, symbol, products, mikran_code, status, request_kind, sales_acknowledged_at, sales_cancelled_at, informacja_stock_out_reorder";

type InformacjaDuplicateRow = {
  id: string;
  sales_person_id: string;
  sales_client_name: string | null;
  sales_client_kh_id: number | null;
  subiekt_tw_id: number | null;
  symbol: string | null;
  products: string | null;
  mikran_code: string | null;
  status: string;
  request_kind: string | null;
  sales_acknowledged_at: string | null;
  sales_cancelled_at: string | null;
  informacja_stock_out_reorder: boolean | null;
};

function mapInformacjaDuplicateRow(row: InformacjaDuplicateRow): InformacjaDuplicateOrderLike {
  return {
    id: row.id,
    salesPersonId: row.sales_person_id,
    clientName: row.sales_client_name,
    clientKhId: row.sales_client_kh_id,
    subiektTwId: row.subiekt_tw_id,
    symbol: row.symbol,
    product: row.products,
    mikranCode: row.mikran_code,
    request_kind: row.request_kind as IndividualRequestKind | null,
    status: row.status,
    sales_acknowledged_at: row.sales_acknowledged_at,
    sales_cancelled_at: row.sales_cancelled_at,
    informacja_stock_out_reorder: row.informacja_stock_out_reorder,
  };
}

export async function fetchActiveInformacjaOrdersForSalesPeople(
  supabase: SupabaseClient,
  salesPersonIds: string[]
): Promise<InformacjaDuplicateOrderLike[]> {
  const uniqueIds = [...new Set(salesPersonIds.filter(Boolean))];
  if (!uniqueIds.length) return [];

  const { data, error } = await supabase
    .from("individual_orders")
    .select(INFORMACJA_DUPLICATE_SELECT)
    .in("sales_person_id", uniqueIds)
    .eq("request_kind", "informacja")
    .is("sales_acknowledged_at", null)
    .neq("status", "Anulowane");

  if (error) throw new Error(error.message);

  return (data as InformacjaDuplicateRow[] | null ?? [])
    .map(mapInformacjaDuplicateRow)
    .filter(isActiveInformacjaOrder);
}

export type InformacjaDuplicateEntryInput = {
  salesPersonId: string;
  clientName?: string | null;
  clientKhId?: number | null;
  symbol?: string | null;
  mikranCode?: string | null;
  product?: string | null;
  subiektTwId?: number | null;
  requestKind?: IndividualRequestKind;
};

function toInformacjaDuplicateCandidate(
  entry: InformacjaDuplicateEntryInput
): InformacjaDuplicateCandidate {
  return {
    salesPersonId: entry.salesPersonId,
    clientName: entry.clientName,
    clientKhId: entry.clientKhId,
    symbol: entry.symbol,
    mikranCode: entry.mikranCode,
    product: entry.product,
    subiektTwId: entry.subiektTwId,
  };
}

export async function assertNoDuplicateInformacjaEntries(
  supabase: SupabaseClient,
  entries: InformacjaDuplicateEntryInput[],
  options?: { excludeOrderIds?: string[] }
): Promise<void> {
  const informacjaEntries = entries.filter(
    (entry) => (entry.requestKind ?? "zamowienie") === "informacja"
  );
  if (!informacjaEntries.length) return;

  const informacjaCandidates = await Promise.all(
    informacjaEntries.map(async (entry) => {
      const base = toInformacjaDuplicateCandidate(entry);
      const subiektTwId = await resolveOrderLineSubiektTwIdFromCatalog(supabase, {
        subiektTwId: entry.subiektTwId,
        symbol: entry.symbol,
        mikranCode: entry.mikranCode,
      });
      return { ...base, subiektTwId };
    })
  );

  const salesPersonIds = informacjaCandidates.map((entry) => entry.salesPersonId);
  const existing = await fetchActiveInformacjaOrdersForSalesPeople(supabase, salesPersonIds);

  assertNoInformacjaDuplicatesInList(informacjaCandidates, existing, {
    excludeIds: options?.excludeOrderIds,
  });
}
