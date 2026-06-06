import {
  assessRequestCompleteness,
  hasAnyProductHint,
  hasValidOrderQuantity,
  type RequestCompleteness,
} from "@/lib/orders/request-completeness";
import type { ProsbaReadinessLine } from "@/lib/orders/prosba-form-readiness";
import type { IndividualRequestKind } from "@/types/database";

export type ProcurementReadinessStepState = "empty" | "done";

export type ProcurementReadinessStep = {
  id: "sales" | "supplier" | "product" | "quantity";
  label: string;
  state: ProcurementReadinessStepState;
  detail: string;
};

export type ProcurementFormReadinessView = {
  headline: string;
  subline: string | null;
  tone: "neutral" | "ready";
  steps: ProcurementReadinessStep[];
  canSubmit: boolean;
};

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function linesWithProduct(lines: ProsbaReadinessLine[]): ProsbaReadinessLine[] {
  return lines.filter((line) =>
    hasAnyProductHint({
      symbol: line.symbol,
      mikranCode: line.mikranCode,
      product: line.product,
    })
  );
}

/** Ocena grupy pozycji (jak w /zamowienia/nowe). */
export function assessProcurementGroupCompleteness(
  lines: ProsbaReadinessLine[],
  supplierId: string,
  requestKind: IndividualRequestKind
): RequestCompleteness | null {
  if (!hasText(supplierId)) return null;
  let anyHint = false;
  for (const row of lines) {
    const draft = {
      supplierId,
      symbol: row.symbol,
      mikranCode: row.mikranCode,
      product: row.product,
      quantity: row.quantity,
      requestKind,
    };
    if (!hasAnyProductHint(draft)) continue;
    anyHint = true;
    if (assessRequestCompleteness(draft) === "incomplete") return "incomplete";
  }
  return anyHint ? "complete" : null;
}

export function buildProcurementFormReadiness(input: {
  salesPersonId: string;
  supplierId: string;
  lines: ProsbaReadinessLine[];
  requestKind: IndividualRequestKind;
  informacjaViaDailyPanel?: boolean;
  informacjaStockOutReorder?: boolean;
}): ProcurementFormReadinessView {
  const { salesPersonId, supplierId, lines, requestKind } = input;
  const isZamowienie = requestKind === "zamowienie";
  const filled = linesWithProduct(lines);
  const groupComplete = assessProcurementGroupCompleteness(lines, supplierId, requestKind);

  const salesDone = hasText(salesPersonId);
  const supplierDone = hasText(supplierId);
  const productDone = filled.length > 0;
  const quantityDone =
    !isZamowienie ||
    (filled.length > 0 &&
      filled.every((line) => hasValidOrderQuantity(line.quantity, "zamowienie")));

  const steps: ProcurementReadinessStep[] = [
    {
      id: "sales",
      label: "Handlowiec",
      state: salesDone ? "done" : "empty",
      detail: salesDone ? "Wybrano osobę" : "Wskaż, dla kogo składasz prośbę",
    },
    {
      id: "supplier",
      label: "Dostawca",
      state: supplierDone ? "done" : "empty",
      detail: supplierDone ? "Wybrano dostawcę" : "Wyszukaj w systemie lub Subiekcie",
    },
    {
      id: "product",
      label: "Produkt",
      state: productDone ? "done" : "empty",
      detail: productDone
        ? filled.length === 1
          ? "Symbol, kod lub opis"
          : `${filled.length} pozycje`
        : "Symbol, kod Mikran lub nazwa z Subiekta",
    },
  ];

  if (isZamowienie) {
    steps.push({
      id: "quantity",
      label: "Ilość",
      state: quantityDone ? "done" : "empty",
      detail: quantityDone ? "Każda pozycja ma sztuki" : "Podaj ilość (np. 1) przy każdym produkcie",
    });
  }

  const canSubmit =
    salesDone && supplierDone && groupComplete === "complete";

  if (canSubmit) {
    return {
      headline: "Można zapisać",
      subline:
        requestKind === "informacja"
          ? input.informacjaStockOutReorder
            ? "Sygnał „brak na stanie” w Prośbach handlowców — zamówienie u dostawcy, bez e-maila do handlowca."
            : input.informacjaViaDailyPanel
              ? "Informacja trafi najpierw do Prośb handlowców — po Główne/Uzupełniające do magazynu."
              : "Informacja o dostępności — kolejka magazynu, potem e-mail do handlowca."
          : "Kompletne dane — trafi do panelu dziennego.",
      tone: "ready",
      steps,
      canSubmit: true,
    };
  }

  const missing = steps.filter((s) => s.state === "empty").map((s) => s.label.toLowerCase());
  return {
    headline: "Uzupełnij zgłoszenie",
    subline: missing.length
      ? `Brakuje: ${missing.join(", ")}.`
      : "Sprawdź ilość i opis przy każdej pozycji.",
    tone: "neutral",
    steps,
    canSubmit: false,
  };
}
