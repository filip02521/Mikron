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
  | "complete";

export type SalesRequestSubmitPlan = {
  submittable: boolean;
  initialStatus: IndividualOrderStatus;
  bannerKind: SalesSubmitBannerKind;
};

export type SalesRequestDraft = RequestDraft & {
  subiektTwId?: number | null;
};

export type SalesSubmitHintTone = "success" | "warning" | "info";

/** Plan zapisu prośby handlowca — bez czekania na dostawcę przy wyborze towaru z Subiekta. */
export function planSalesRequestSubmit(draft: SalesRequestDraft): SalesRequestSubmitPlan {
  const kind = draft.requestKind ?? "zamowienie";

  if (!hasAnyProductHint(draft)) {
    return {
      submittable: false,
      initialStatus: "Weryfikacja",
      bannerKind: "empty",
    };
  }

  if (kind === "zamowienie" && !hasValidOrderQuantity(draft.quantity, kind)) {
    return {
      submittable: false,
      initialStatus: "Weryfikacja",
      bannerKind: "incomplete",
    };
  }

  if (assessRequestCompleteness(draft) === "complete") {
    return {
      submittable: true,
      initialStatus: "Nowe",
      bannerKind: "complete",
    };
  }

  return {
    submittable: true,
    initialStatus: "Weryfikacja",
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
            ? "Twoje dane wystarczą do zgłoszenia. Dział zakupów dopasuje dostawcę i dopracuje szczegóły — śledź postęp w „Moje zamówienia”."
            : "Produkt i ilość są podane — to wystarczy do wysłania. Dział zakupów dopasuje dostawcę i dopracuje resztę — śledź postęp w „Moje zamówienia”.",
      };
    case "complete":
      return {
        tone: "success",
        title: "Zgłoszenie kompletne",
        detail:
          requestKind === "informacja"
            ? "Trafia od razu do działu zakupów — bez dodatkowego sprawdzania."
            : "Dostawca, produkt i ilość są podane — trafia od razu do realizacji.",
      };
  }
}

const BANNER_PRIORITY: Record<SalesSubmitBannerKind, number> = {
  incomplete: 0,
  complete: 1,
  empty: 2,
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
