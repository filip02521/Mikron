/**
 * Bezpieczniki linii propozycji ZD automatu (zadanie 4, TASKS.md; spec §3.5).
 * Właściciel znaczenia `ZdAutoProposalLine.flags` (zd-automat-contract.ts).
 * Do zaimplementowania — dziś zwraca linie bez zmian.
 */
import type { ZdAutoProposalLine } from "@/lib/data/zd-auto-proposals";
import type { ZdProposalFlag } from "@/lib/orders/zd-automat-contract";
import type { ZdProposalHookContext } from "@/lib/orders/zd-proposal-hook-context";

export async function applyZdProposalGuards(
  ctx: ZdProposalHookContext
): Promise<{ lines: ZdAutoProposalLine[]; proposalFlags: ZdProposalFlag[] }> {
  return { lines: ctx.lines, proposalFlags: [] };
}
