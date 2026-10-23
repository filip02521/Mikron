import type { ZdProposalLineFlag } from "@/lib/orders/zd-automat-contract";

/** Bezpieczniki linii propozycji (zadanie 4) — do zaimplementowania; dziś nic nie rysuje. */
export function ZdProposalLineFlags({ flags }: { flags?: ZdProposalLineFlag[] }) {
  if (!flags?.length) return null;
  return null;
}
