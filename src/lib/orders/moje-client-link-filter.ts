import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { orderExplicitlyLinkedToZkWatch } from "@/lib/orders/zk-prosba-source";
import {
  clientsMatchForSalesClient,
  normalizeSalesClientKhId,
} from "@/lib/orders/sales-client-match";

export type MojeClientLinkFilter = {
  khId?: number | null;
  /** Etykieta z ?klient= (link z notatnika / ZK). */
  clientLabel?: string | null;
  /** Karta ZK z notatnika — prośby z przycisku Prośba (niezależnie od nazwy klienta). */
  zkWatchId?: string | null;
  zkNumber?: string | null;
};

function filterActive(filter: MojeClientLinkFilter | null | undefined): MojeClientLinkFilter | null {
  if (!filter) return null;
  const khId = normalizeSalesClientKhId(filter.khId);
  const clientLabel = filter.clientLabel?.trim() || null;
  const zkWatchId = filter.zkWatchId?.trim() || null;
  const zkNumber = filter.zkNumber?.trim() || null;
  if (khId == null && !clientLabel && !zkWatchId && !zkNumber) return null;
  return { khId, clientLabel, zkWatchId, zkNumber };
}

function rowMatchesZkSourceFilter(
  row: MyOrderRow,
  active: Pick<MojeClientLinkFilter, "zkWatchId" | "zkNumber">
): boolean {
  const watchId = active.zkWatchId?.trim();
  const zkNumber = active.zkNumber?.trim();
  if (!watchId && !zkNumber) return false;
  if (!row.sourceZkWatchId && !row.sourceZkNumber) return false;
  return orderExplicitlyLinkedToZkWatch(
    {
      source_zk_watch_id: row.sourceZkWatchId ?? null,
      source_zk_number: row.sourceZkNumber ?? null,
    },
    { id: watchId ?? "", zk_number: zkNumber ?? "" }
  );
}

export function rowMatchesMojeClientLinkFilter(
  row: MyOrderRow,
  filter: MojeClientLinkFilter | null | undefined
): boolean {
  const active = filterActive(filter);
  if (!active) return true;

  if (rowMatchesZkSourceFilter(row, active)) return true;

  const client = {
    client_kh_id: active.khId,
    client_label: active.clientLabel ?? row.clientLabel ?? "",
  };

  for (const line of row.lines) {
    if (
      clientsMatchForSalesClient(client, {
        sales_client_kh_id: line.clientKhId,
        sales_client_name: line.clientName,
      })
    ) {
      return true;
    }
  }

  if (active.clientLabel && row.clientLabel?.trim()) {
    if (
      clientsMatchForSalesClient(client, {
        sales_client_kh_id: null,
        sales_client_name: row.clientLabel,
      })
    ) {
      return true;
    }
  }

  return false;
}

export function filterMyOrderRowsByClientLink(
  rows: MyOrderRow[],
  filter: MojeClientLinkFilter | null | undefined
): MyOrderRow[] {
  if (!filterActive(filter)) return rows;
  return rows.filter((row) => rowMatchesMojeClientLinkFilter(row, filter));
}
