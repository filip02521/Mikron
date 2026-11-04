import {
  zkLineIncomingCover,
  type ProsbaAlreadyOrderedMap,
  type ProsbaIncomingZdDoc,
} from "@/lib/orders/prosba-already-ordered";
import {
  assessProsbaLineStock,
  type ProsbaLineStockSnapshot,
} from "@/lib/orders/prosba-stock-check";

export type ZkAttachIncomingLineInput = {
  key: string;
  subiektTwId: number | null;
  quantity: number | null;
};

export type ZkAttachIncomingCandidate = {
  key: string;
  subiektTwId: number;
  quantity: number;
  /** ZD z terminem w przód, pod który podpinamy pozycję. */
  doc: ProsbaIncomingZdDoc;
};

/**
 * Pozycje ZK, które pokryje towar w drodze (ZD z terminem w przód, wolne po cudzych ZK)
 * i które można „podpiąć” pod tę dostawę zamiast składać prośbę do zakupów.
 *
 * Pomijamy: towar wystarczający na półce (nic nie trzeba), towar zwolniony ze sprawdzania
 * stanu (zęby), pozycje z `excludeKeys` (zaznaczone do zamówienia, już objęte prośbą),
 * towar z otwartą prośbą handlowca (druga byłaby dublem) i ZD bez pewnego terminu.
 * Kilka pozycji tego samego towaru dzieli jedną dostawę — liczymy je narastająco.
 * `requireSupplier`: serwer podpina tylko ZD z ustalonym dostawcą OnTime.
 */
export function selectZkLinesToAttachIncoming(input: {
  lines: readonly ZkAttachIncomingLineInput[];
  stockByTwId: Record<number, ProsbaLineStockSnapshot>;
  incomingByTwId: ProsbaAlreadyOrderedMap;
  excludeKeys?: ReadonlySet<string>;
  stockExemptTwIds?: ReadonlySet<number>;
  requireSupplier?: boolean;
  todayKey?: string;
}): ZkAttachIncomingCandidate[] {
  const out: ZkAttachIncomingCandidate[] = [];
  const claimedByTwId = new Map<number, number>();
  for (const line of input.lines) {
    const twId = line.subiektTwId;
    const qty = line.quantity;
    if (twId == null || qty == null || !(qty > 0)) continue;
    if (input.excludeKeys?.has(line.key)) continue;
    if (input.stockExemptTwIds?.has(twId)) continue;
    const snap = input.stockByTwId[twId];
    if (snap && assessProsbaLineStock({ requestedQty: qty, stock: snap }) === "sufficient") continue;
    const info = input.incomingByTwId[twId];
    if (!info || info.own.length > 0) continue;
    const claimed = claimedByTwId.get(twId) ?? 0;
    const cover = zkLineIncomingCover(info.incoming, claimed + qty, input.todayKey);
    if (!cover?.covered || !cover.certain || !cover.doc) continue;
    if (input.requireSupplier && !cover.doc.supplierId) continue;
    claimedByTwId.set(twId, claimed + qty);
    out.push({ key: line.key, subiektTwId: twId, quantity: qty, doc: cover.doc });
  }
  return out;
}
