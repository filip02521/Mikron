import { zkNumbersEquivalent } from "@/lib/subiekt/zk-document";

export type ZkProsbaSourceInput = {
  sourceZkWatchId?: string | null;
  sourceZkNumber?: string | null;
};

export type ZkProsbaSourceStored = {
  source_zk_watch_id: string | null;
  source_zk_number: string | null;
};

export function normalizeZkProsbaSourceInput(
  input: ZkProsbaSourceInput | null | undefined
): ZkProsbaSourceStored {
  const watchId = input?.sourceZkWatchId?.trim() || null;
  const zkNumber = input?.sourceZkNumber?.trim() || null;
  return {
    source_zk_watch_id: watchId,
    source_zk_number: zkNumber,
  };
}

export function orderExplicitlyLinkedToZkWatch(
  order: Pick<ZkProsbaSourceStored, "source_zk_watch_id" | "source_zk_number">,
  watch: { id: string; zk_number: string }
): boolean {
  const watchId = watch.id?.trim();
  if (watchId && order.source_zk_watch_id === watchId) return true;

  const watchZk = watch.zk_number?.trim();
  const orderZk = order.source_zk_number?.trim();
  if (watchZk && orderZk && zkNumbersEquivalent(orderZk, watchZk)) return true;

  return false;
}

/** Zachowaj powiązanie ZK przy edycji / nowych liniach w tej samej prośbie. */
export function zkProsbaSourceFromOrder(
  order:
    | {
        source_zk_watch_id?: string | null;
        source_zk_number?: string | null;
      }
    | null
    | undefined
): ZkProsbaSourceStored {
  return normalizeZkProsbaSourceInput({
    sourceZkWatchId: order?.source_zk_watch_id,
    sourceZkNumber: order?.source_zk_number,
  });
}
