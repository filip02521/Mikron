import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestDraft,
} from "@/lib/orders/request-completeness";
import type { IndividualOrderStatus } from "@/types/database";

export type ProcurementEntryDraft = RequestDraft & {
  subiektTwId?: number | null;
};

/** Zakupy: zamówienie trafia do panelu dziennego tylko jako kompletne. */
export function assertProcurementEntryComplete(
  draft: ProcurementEntryDraft,
  label?: string
): void {
  const prefix = label ? `${label}: ` : "";
  const kind = draft.requestKind ?? "zamowienie";

  if (!hasAnyProductHint(draft)) {
    throw new Error(`${prefix}podaj symbol, kod Mikran lub opis produktu.`);
  }
  if (kind === "zamowienie") {
    if (!draft.supplierId?.trim()) {
      throw new Error(`${prefix}wybierz dostawcę.`);
    }
    if (!hasValidOrderQuantity(draft.quantity, kind)) {
      throw new Error(`${prefix}podaj ilość (liczba sztuk, np. 1).`);
    }
  }
  if (
    kind === "informacja" &&
    (draft.informacjaQueueViaDailyPanel || draft.informacjaStockOutReorder)
  ) {
    if (!draft.supplierId?.trim()) {
      throw new Error(`${prefix}wybierz dostawcę — ta ścieżka wymaga dostawcy w panelu Dziś.`);
    }
  }
  if (assessRequestCompleteness({ ...draft, requestKind: kind }) !== "complete") {
    throw new Error(`${prefix}uzupełnij wszystkie wymagane pola.`);
  }
}

export function procurementStatusForEntry(draft: ProcurementEntryDraft): IndividualOrderStatus {
  assertProcurementEntryComplete(draft);
  return "Nowe";
}

export function shouldLinkProcurementCatalogEntry(draft: ProcurementEntryDraft): boolean {
  const twId = draft.subiektTwId != null ? Math.trunc(Number(draft.subiektTwId)) : null;
  return (
    twId != null &&
    twId > 0 &&
    Boolean(draft.supplierId?.trim())
  );
}
