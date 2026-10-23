import type { ZdAutoProposal } from "@/lib/data/zd-auto-proposals";

/** Minimum / próg darmowej dostawy propozycji (zadanie 5) — do zaimplementowania; dziś nic nie rysuje. */
export function ZdProposalMinimumNotice({ proposal }: { proposal: ZdAutoProposal }) {
  if (proposal.status !== "deferred") return null;
  return null;
}
