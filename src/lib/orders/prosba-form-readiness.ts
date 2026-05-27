import { hasAnyProductHint, hasValidOrderQuantity } from "@/lib/orders/request-completeness";
import type { SalesRequestSubmitPlan } from "@/lib/orders/sales-request-submit";
import type { IndividualRequestKind } from "@/types/database";

export type ProsbaReadinessStepState = "empty" | "done" | "action" | "handoff";

export type ProsbaReadinessStep = {
  id: "product" | "quantity" | "supplier";
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
  /** Trwa wyszukiwanie dostawcy w Subiekcie (ZD) po wyborze towaru. */
  resolvingSupplier?: boolean;
};

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

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
  const resolvingSupplier = Boolean(options?.resolvingSupplier);
  const hasSubiektProduct = filled.some(
    (line) => line.subiektTwId != null && line.subiektTwId > 0
  );
  const hasResolvedSupplier = filled.some((line) => hasText(line.supplierId));

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
  } else if (resolvingSupplier && hasSubiektProduct && !hasResolvedSupplier) {
    supplierStep = {
      ...supplierStep,
      state: "action",
      detail: "Sprawdzamy historię ZD w Subiekcie…",
    };
  } else if (hasResolvedSupplier) {
    supplierStep = {
      ...supplierStep,
      state: "done",
      detail: "Znaleziony w historii ZD — trafia do panelu dziennego",
    };
  } else if (plan.bannerKind === "pending_supplier") {
    supplierStep = {
      ...supplierStep,
      state: "handoff",
      detail: "Nie znaleziono w ZD przy wyborze — po wysłaniu sprawdzimy ponownie",
    };
  } else {
    supplierStep = {
      ...supplierStep,
      state: "handoff",
      detail: "Po wysłaniu: dopasuje dział dostaw",
    };
  }

  const steps = isZamowienie
    ? [productStep, quantityStep, supplierStep]
    : [productStep, supplierStep];

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
      subline: "Kompletne — trafi od razu do realizacji.",
      tone: "ready",
      steps,
      canSubmit: true,
    };
  }

  if (plan?.bannerKind === "pending_supplier") {
    return {
      headline: "Gotowe do wysłania",
      subline: hasResolvedSupplier
        ? "Dostawca z historii ZD — możesz wysłać prośbę."
        : resolvingSupplier
          ? "Sprawdzamy historię ZD w Subiekcie…"
          : "Towar z Subiekta — dostawcę ustalimy z historii ZD.",
      tone: "ready",
      steps,
      canSubmit: true,
    };
  }

  return {
    headline: "Możesz wysłać prośbę",
    subline: "Dział dostaw dopracuje dostawcę — śledź postęp w „Moje zamówienia”.",
    tone: "handoff",
    steps,
    canSubmit: true,
  };
}
