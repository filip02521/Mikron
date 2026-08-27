import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllZkLinkableOrdersForSalesPerson } from "@/lib/sales/zk-watch-close-pending-fetch";
import { computeZkWatchOrderHints } from "@/lib/sales/zk-watch-order-link";
import { buildZkWatchLineViews } from "@/lib/sales/zk-watch-lines";
import type { SalesZkWatch } from "@/types/database";

export const ZK_PROSBA_LINES_ALREADY_COVERED_MESSAGE =
  "Te pozycje ZK są już pokryte otwartą prośbą — nic nie dodano. Odśwież kartę ZK.";

export const ZK_PROSBA_LINES_PARTIAL_COVERED_MESSAGE =
  "Część pozycji jest już w otwartej prośbie — odśwież kartę ZK i wyślij tylko brakujące.";

export const ZK_PROSBA_NO_UNCOVERED_LINES_MESSAGE =
  "Brak pozycji ZK do zamówienia — odśwież kartę ZK.";

type ZkLinkedEntryLike = {
  requestKind?: string | null;
  sourceZkWatchId?: string | null;
  sourceZkLineKeys?: string[] | null;
  subiektTwId?: number | null;
};

/**
 * Odrzuca zamowienie powiązane z ZK, gdy wskazane linie są już w otwartej prośbie
 * (parity z AUTO eligibility). Orphan keys (poza snapshotem) są ignorowane —
 * assert catalog i tak pilnuje TW.
 */
export async function assertZkLinkedZamowienieStillUncovered(input: {
  watch: SalesZkWatch;
  entries: ZkLinkedEntryLike[];
  /** Test inject. */
  orders?: Parameters<typeof computeZkWatchOrderHints>[1];
}): Promise<void> {
  const zamowienieEntries = input.entries.filter(
    (e) => (e.requestKind ?? "zamowienie") === "zamowienie"
  );
  if (!zamowienieEntries.length) return;

  const orders =
    input.orders ??
    (await fetchAllZkLinkableOrdersForSalesPerson(
      createAdminClient(),
      input.watch.sales_person_id
    ));

  const hints = computeZkWatchOrderHints(input.watch, orders);
  const uncovered = new Set(hints.uncoveredLineKeys);
  const openCovered = new Set(hints.openProsbaCoveredLineKeys);

  const views = buildZkWatchLineViews(input.watch);
  const viewKeys = new Set(
    views.filter((v) => v.key !== "summary").map((v) => v.key)
  );
  const twIdToKeys = new Map<number, string[]>();
  for (const view of views) {
    if (view.key === "summary") continue;
    const tw = view.subiektTwId;
    if (tw == null || tw <= 0) continue;
    const list = twIdToKeys.get(tw) ?? [];
    list.push(view.key);
    twIdToKeys.set(tw, list);
  }

  const requestedKeys = new Set<string>();
  for (const entry of zamowienieEntries) {
    const keys = Array.isArray(entry.sourceZkLineKeys)
      ? entry.sourceZkLineKeys.map((k) => String(k).trim()).filter(Boolean)
      : [];
    if (keys.length) {
      for (const k of keys) requestedKeys.add(k);
      continue;
    }
    const twId = Math.trunc(Number(entry.subiektTwId) || 0);
    if (twId > 0) {
      for (const k of twIdToKeys.get(twId) ?? []) requestedKeys.add(k);
    }
  }

  if (requestedKeys.size === 0) {
    return;
  }

  const requestedKnown = [...requestedKeys].filter((k) => viewKeys.has(k));
  if (requestedKnown.length === 0) {
    // Same orphan keys poza snapshotem — nie udawaj „pokryte otwartą prośbą”.
    return;
  }

  const uncoveredRequested = requestedKnown.filter((k) => uncovered.has(k));
  const coveredRequested = requestedKnown.filter((k) => openCovered.has(k));

  if (uncoveredRequested.length === 0) {
    if (coveredRequested.length > 0) {
      throw new Error(ZK_PROSBA_LINES_ALREADY_COVERED_MESSAGE);
    }
    throw new Error(ZK_PROSBA_NO_UNCOVERED_LINES_MESSAGE);
  }

  if (coveredRequested.length > 0) {
    throw new Error(ZK_PROSBA_LINES_PARTIAL_COVERED_MESSAGE);
  }
}
