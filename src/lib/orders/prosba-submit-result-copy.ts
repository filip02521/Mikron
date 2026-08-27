import type { IndividualRequestKind } from "@/types/database";
import {
  PROCUREMENT_TEAM_LABEL,
  PROCUREMENT_TEAM_LABEL_TITLE,
} from "@/lib/orders/procurement-copy";

export type ProsbaSubmitResultCounts = {
  count: number;
  complete: number;
  verification: number;
};

/** Komunikat sukcesu po zapisie prośby / batchu (handlowiec vs zakupy). */
export function formatSubmitResult(
  r: ProsbaSubmitResultCounts,
  requestKind: IndividualRequestKind,
  forSales?: boolean
): string {
  const { complete, verification } = r;
  if (forSales) {
    if (verification > 0 && complete === 0) {
      return "Prośba zapisana — dział zakupów dopracuje szczegóły. Śledź status w „Moje zamówienia”.";
    }
    if (verification > 0 && complete > 0) {
      return `Zapisano prośbę (${complete} od razu do realizacji, ${verification} do weryfikacji). Sprawdź „Moje zamówienia”.`;
    }
    return requestKind === "informacja"
      ? "Prośba o dostępność zapisana."
      : "Prośba zapisana.";
  }
  if (verification > 0 && complete > 0) {
    return `Zapisano ${complete} kompletnych i ${verification} do weryfikacji przez ${PROCUREMENT_TEAM_LABEL}.`;
  }
  if (verification > 0) {
    return `Przekazano ${verification} pozycji do weryfikacji — ${PROCUREMENT_TEAM_LABEL} uzupełni brakujące dane (dostawca, opis).`;
  }
  if (requestKind === "informacja") {
    return `Dodano ${complete} prośb(y) informacyjn(e). ${PROCUREMENT_TEAM_LABEL_TITLE} powiadomi Cię e-mailem, gdy towar będzie na magazynie.`;
  }
  return `Dodano ${complete} pozycji do panelu dziennego.`;
}
