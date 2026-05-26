import type { IndividualOrderStatus, IndividualRequestKind } from "@/types/database";
import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestDraft,
} from "@/lib/orders/request-completeness";

export type SalesSubmitBannerKind =
  | "empty"
  | "incomplete"
  | "complete"
  | "pending_supplier";

export type SalesRequestSubmitPlan = {
  submittable: boolean;
  initialStatus: IndividualOrderStatus;
  supplierResolvePending: boolean;
  bannerKind: SalesSubmitBannerKind;
};

export type SalesRequestDraft = RequestDraft & {
  subiektTwId?: number | null;
};

export type SalesSubmitHintTone = "success" | "warning" | "info";

function hasSubiektProduct(draft: SalesRequestDraft): boolean {
  const id = draft.subiektTwId;
  return id != null && id > 0;
}

/** Plan zapisu prośby handlowca — bez czekania na dostawcę przy wyborze towaru z Subiekta. */
export function planSalesRequestSubmit(draft: SalesRequestDraft): SalesRequestSubmitPlan {
  const kind = draft.requestKind ?? "zamowienie";

  if (!hasAnyProductHint(draft)) {
    return {
      submittable: false,
      initialStatus: "Weryfikacja",
      supplierResolvePending: false,
      bannerKind: "empty",
    };
  }

  if (kind === "zamowienie" && !hasValidOrderQuantity(draft.quantity, kind)) {
    return {
      submittable: false,
      initialStatus: "Weryfikacja",
      supplierResolvePending: false,
      bannerKind: "incomplete",
    };
  }

  if (assessRequestCompleteness(draft) === "complete") {
    return {
      submittable: true,
      initialStatus: "Nowe",
      supplierResolvePending: false,
      bannerKind: "complete",
    };
  }

  if (hasSubiektProduct(draft)) {
    return {
      submittable: true,
      initialStatus: "Weryfikacja",
      supplierResolvePending: true,
      bannerKind: "pending_supplier",
    };
  }

  return {
    submittable: true,
    initialStatus: "Weryfikacja",
    supplierResolvePending: false,
    bannerKind: "incomplete",
  };
}

/** Komunikat w panelu statusu formularza prośby — rozróżnia „blokada” vs „można wysłać”. */
export function salesSubmitUserHint(
  plan: SalesRequestSubmitPlan,
  requestKind: IndividualRequestKind
): { tone: SalesSubmitHintTone; title: string; detail: string } | null {
  if (!plan.submittable) {
    if (plan.bannerKind === "empty") return null;
    if (plan.bannerKind === "incomplete") {
      return {
        tone: "warning",
        title: "Uzupełnij przed wysłaniem",
        detail:
          requestKind === "informacja"
            ? "Podaj symbol, kod Mikran lub opis produktu — dopiero wtedy wyślesz prośbę."
            : "Podaj symbol, kod Mikran lub opis produktu oraz ilość (np. 1) — dopiero wtedy wyślesz prośbę.",
      };
    }
    return null;
  }

  switch (plan.bannerKind) {
    case "empty":
      return null;
    case "incomplete":
      return {
        tone: "info",
        title: "Możesz wysłać prośbę",
        detail:
          requestKind === "informacja"
            ? "Twoje dane wystarczą do zgłoszenia. Dział dostaw dopasuje dostawcę i dopracuje szczegóły — śledź postęp w „Moje zamówienia”."
            : "Produkt i ilość są podane — to wystarczy do wysłania. Dział dostaw dopasuje dostawcę i dopracuje resztę — śledź postęp w „Moje zamówienia”.",
      };
    case "pending_supplier":
      return {
        tone: "success",
        title: "Gotowe do wysłania",
        detail:
          requestKind === "informacja"
            ? "Towar z Subiekta jest zapisany. Po wysłaniu system dopasuje dostawcę w tle — zwykle bez Twojego udziału."
            : "Towar z Subiekta jest zapisany. Po wysłaniu system dopasuje dostawcę z historii ZD — zwykle bez Twojego udziału.",
      };
    case "complete":
      return {
        tone: "success",
        title: "Zgłoszenie kompletne",
        detail:
          requestKind === "informacja"
            ? "Trafia od razu do działu dostaw — bez dodatkowego sprawdzania."
            : "Dostawca, produkt i ilość są podane — trafia od razu do panelu dziennego.",
      };
  }
}

const BANNER_PRIORITY: Record<SalesSubmitBannerKind, number> = {
  incomplete: 0,
  pending_supplier: 1,
  complete: 2,
  empty: 3,
};

function mergeSubmitPlans(
  a: SalesRequestSubmitPlan,
  b: SalesRequestSubmitPlan
): SalesRequestSubmitPlan {
  if (!a.submittable) return a;
  if (!b.submittable) return b;
  return BANNER_PRIORITY[a.bannerKind] <= BANNER_PRIORITY[b.bannerKind] ? a : b;
}

/** Ocena grupy produktów w formularzu handlowca (prośba). */
export function assessSalesGroupSubmittable(
  rows: Array<{
    supplierId?: string;
    symbol?: string;
    mikranCode?: string;
    product?: string;
    quantity?: string;
    subiektTwId?: number | null;
  }>,
  groupSupplierId: string,
  requestKind: IndividualRequestKind
): SalesRequestSubmitPlan | null {
  let anyLine = false;
  let merged: SalesRequestSubmitPlan | null = null;

  for (const row of rows) {
    const draft: SalesRequestDraft = {
      supplierId: groupSupplierId || row.supplierId,
      symbol: row.symbol,
      mikranCode: row.mikranCode,
      product: row.product,
      quantity: row.quantity,
      requestKind,
      subiektTwId: row.subiektTwId,
    };
    if (!hasAnyProductHint(draft)) continue;
    anyLine = true;
    const plan = planSalesRequestSubmit(draft);
    if (!plan.submittable) return plan;
    merged = merged ? mergeSubmitPlans(merged, plan) : plan;
  }

  return anyLine ? merged : null;
}
