import { hasAnyProductHint, hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import { PROCUREMENT_TEAM_LABEL } from "./procurement-copy";
import type { SalesRequestSubmitPlan } from "@/lib/orders/sales-request-submit";
import { assessSalesGroupSubmittable } from "@/lib/orders/sales-request-submit";
import type { IndividualRequestKind } from "@/types/database";
import type { InformacjaFlowPath } from "@/lib/orders/informacja-stock-out-reorder";
import {
  informacjaFlowUiForPath,
  informacjaReadinessSubline,
} from "@/lib/orders/informacja-flow-ui";

export type ProsbaReadinessStepState = "empty" | "done" | "action" | "handoff";

export type ProsbaReadinessStep = {
  id: "product" | "quantity" | "supplier" | "path";
  label: string;
  state: ProsbaReadinessStepState;
  detail: string;
};

export type ProsbaFormReadinessView = {
  headline: string;
  subline: string | null;
  tone: "neutral" | "ready" | "blocked" | "handoff";
  steps: ProsbaReadinessStep[];
  canSubmit: boolean;
};

export type ProsbaReadinessLine = {
  symbol?: string;
  mikranCode?: string;
  product?: string;
  quantity?: string;
  supplierId?: string;
  subiektTwId?: number | null;
};

export type ProsbaFormReadinessOptions = {
  informacjaPath?: InformacjaFlowPath;
  resolvingSupplier?: boolean;
};

function linesWithProductHint(lines: ProsbaReadinessLine[]): ProsbaReadinessLine[] {
  return lines.filter((line) =>
    hasAnyProductHint({
      symbol: line.symbol,
      mikranCode: line.mikranCode,
      product: line.product,
    })
  );
}

/** Podsumowanie gotowości formularza prośby — checklista zamiast długiego opisu. */
export function buildProsbaFormReadiness(
  lines: ProsbaReadinessLine[],
  requestKind: IndividualRequestKind,
  plan: SalesRequestSubmitPlan | null,
  options?: ProsbaFormReadinessOptions
): ProsbaFormReadinessView {
  const filled = linesWithProductHint(lines);
  const isZamowienie = requestKind === "zamowienie";
  const informacjaPath = options?.informacjaPath ?? "direct";
  void options?.resolvingSupplier;

  const productDone = filled.length > 0;
  const quantityDone =
    !isZamowienie ||
    (filled.length > 0 &&
      filled.every((line) => hasValidOrderQuantity(line.quantity, "zamowienie")));

  const productStep: ProsbaReadinessStep = {
    id: "product",
    label: "Produkt",
    state: productDone ? "done" : "empty",
    detail: productDone
      ? filled.length === 1
        ? "Symbol, kod lub opis"
        : `${filled.length} pozycje`
      : "Symbol, kod Mikran lub nazwa",
  };

  const quantityStep: ProsbaReadinessStep = {
    id: "quantity",
    label: "Ilość",
    state: !isZamowienie
      ? "done"
      : !productDone
        ? "empty"
        : quantityDone
          ? "done"
          : "action",
    detail: !isZamowienie
      ? "Nie dotyczy (informacja)"
      : quantityDone
        ? "Podana przy każdej pozycji"
        : "Liczba sztuk, np. 1",
  };

  let supplierStep: ProsbaReadinessStep = {
    id: "supplier",
    label: "Dostawca",
    state: "empty",
    detail: "Po wysłaniu — dopasowanie lub zakupy",
  };

  if (!plan || !productDone) {
    supplierStep = {
      ...supplierStep,
      state: "empty",
      detail: "Uzupełnij produkt powyżej",
    };
  } else if (!plan.submittable) {
    supplierStep = {
      ...supplierStep,
      state: "empty",
      detail: "Uzupełnij wymagane pola",
    };
  } else if (plan.bannerKind === "complete") {
    supplierStep = {
      ...supplierStep,
      state: "done",
      detail: "Wybrany — trafia do panelu dziennego",
    };
  } else {
    supplierStep = {
      ...supplierStep,
      state: "handoff",
      detail: `Po wysłaniu: dopasuje ${PROCUREMENT_TEAM_LABEL}`,
    };
  }

  const pathStep: ProsbaReadinessStep = {
    id: "path",
    label: "Ścieżka",
    state: "done",
    detail: informacjaFlowUiForPath(informacjaPath).label,
  };

  const steps = isZamowienie
    ? [productStep, quantityStep, supplierStep]
    : [productStep, pathStep, supplierStep];

  if (!productDone) {
    return {
      headline: "Wpisz produkt",
      subline: "Poniżej zobaczysz, co jest gotowe do wysłania.",
      tone: "neutral",
      steps,
      canSubmit: false,
    };
  }

  if (plan && !plan.submittable) {
    return {
      headline: "Uzupełnij przed wysłaniem",
      subline: isZamowienie && !quantityDone
        ? "Brakuje ilości przy co najmniej jednej pozycji."
        : "Sprawdź podświetlone pola produktów.",
      tone: "blocked",
      steps: steps.map((s) =>
        s.id === "quantity" && !quantityDone ? { ...s, state: "action" as const } : s
      ),
      canSubmit: false,
    };
  }

  if (plan?.bannerKind === "complete") {
    return {
      headline: "Gotowe do wysłania",
      subline: isZamowienie
        ? "Kompletne — trafi od razu do realizacji."
        : informacjaReadinessSubline(informacjaPath, "complete"),
      tone: "ready",
      steps,
      canSubmit: true,
    };
  }

  return {
    headline: isZamowienie ? "Możesz wysłać prośbę" : "Możesz wysłać informację",
    subline: isZamowienie
      ? "Dział dostaw dopracuje dostawcę — śledź postęp w „Moje zamówienia”."
      : informacjaReadinessSubline(informacjaPath, "incomplete"),
    tone: "handoff",
    steps,
    canSubmit: true,
  };
}

/** Gotowość z planem dostawcy (panel dzienny / edycja zakupów). */
export function buildProsbaFormReadinessWithSupplier(
  lines: ProsbaReadinessLine[],
  supplierId: string,
  requestKind: IndividualRequestKind,
  options?: ProsbaFormReadinessOptions
): { plan: SalesRequestSubmitPlan | null; view: ProsbaFormReadinessView } {
  const plan = assessSalesGroupSubmittable(
    lines.map((line) => ({ ...line, supplierId: supplierId || line.supplierId })),
    supplierId,
    requestKind
  );
  return {
    plan,
    view: buildProsbaFormReadiness(lines, requestKind, plan, options),
  };
}
