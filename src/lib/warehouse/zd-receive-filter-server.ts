import { loadZdPairMatchIndex } from "@/lib/orders/zd-product-pair-stock";
import {
  buildZdReceiveFilterState,
  type ZdReceiveFilterState,
} from "@/lib/warehouse/zd-receive-filter";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektDocument } from "@/lib/subiekt/types";

/** Buduje filtr przyjęcia z mapą par (twin pack↔piece) — tylko serwer. */
export async function buildZdReceiveFilterStateWithPairs(input: {
  dokId: number;
  doc: SubiektDocument;
  supplier: AppSupplierRef;
}): Promise<ZdReceiveFilterState> {
  const pairs = await loadZdPairMatchIndex();
  return buildZdReceiveFilterState({ ...input, pairs });
}
