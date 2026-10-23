/**
 * Minimum zamówienia i próg darmowej dostawy dla propozycji ZD automatu (zadanie 5, TASKS.md;
 * spec §3.4). Właściciel statusu `deferred` i `deferredReason`. Cena zakupu = kartotekowa
 * z API (`GET /products/{id}/price/catalog`), fallback cena z ostatniego ZD.
 * Do zaimplementowania — dziś nic nie zmienia.
 */
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdProposalMinimumOutcome } from "@/lib/orders/zd-automat-contract";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";

export async function applyZdProposalMinimum(
  ctx: ZdProposalHookContext
): Promise<{ lines: ZdAutoProposalLine[]; outcome: ZdProposalMinimumOutcome }> {
  return { lines: ctx.lines, outcome: { kind: "ok" } };
}
