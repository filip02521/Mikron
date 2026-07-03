import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import {
  INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT,
  INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE,
  INFORMACJA_FLOW_SALES_DIRECT,
  INFORMACJA_FLOW_SALES_STOCK_OUT,
  INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED,
  isInformacjaAvailabilityPendingStatusTitle,
} from "@/lib/orders/informacja-flow-copy";
import { isProsbaHandoffStatus } from "@/lib/orders/my-order-sales-ui";

export type MyOrderRequestProgressStepState = "done" | "current" | "upcoming";

export type MyOrderRequestProgressStep = {
  id: string;
  label: string;
  state: MyOrderRequestProgressStepState;
  date?: string | null;
};

export type MyOrderRequestProgressTrack = {
  steps: MyOrderRequestProgressStep[];
  /** Akcent paska — spójny z typem prośby. */
  accent: "default" | "informacja";
};

/** Czy pokazać pasek postępu w rozwiniętym wierszu. */
export function shouldShowMyOrderRequestProgress(row: MyOrderRow): boolean {
  if (row.acknowledgeMode === "cancelled" || row.acknowledgeMode === "cancel_notice") {
    return false;
  }
  if (row.statusTitle === "Anulowano" || row.statusTitle === "Anulowane") {
    return false;
  }
  return deriveMyOrderRequestProgress(row) !== null;
}

export function deriveMyOrderRequestProgress(
  row: MyOrderRow
): MyOrderRequestProgressTrack | null {
  if (row.kind === "informacja") {
    return deriveInformacjaRequestProgress(row);
  }
  return deriveZamowienieRequestProgress(row);
}

function markSteps(
  labels: readonly { id: string; label: string; date?: string | null }[],
  currentIndex: number
): MyOrderRequestProgressStep[] {
  return labels.map((step, index) => ({
    id: step.id,
    label: step.label,
    date: step.date ?? null,
    state:
      index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
  }));
}

function deriveZamowienieRequestProgress(row: MyOrderRow): MyOrderRequestProgressTrack | null {
  const labels = [
    { id: "request", label: "Prośba", date: row.submittedLabel },
    { id: "order", label: "Zamówienie", date: row.orderedAtLabel ?? null },
    { id: "delivery", label: "Dostawa", date: row.deliveryAtLabel ?? null },
    { id: "pickup", label: "Odbiór" },
  ] as const;

  const currentIndex = zamowienieCurrentStepIndex(row);
  if (currentIndex < 0) return null;

  return {
    accent: "default",
    steps: markSteps(labels, currentIndex),
  };
}

function zamowienieCurrentStepIndex(row: MyOrderRow): number {
  if (row.acknowledgeMode === "pickup" || row.statusTitle === "Do odbioru") {
    return 3;
  }

  if (row.statusTitle === "Częściowo na magazynie") {
    return 2;
  }

  if (row.statusTitle === "Zamówione") {
    return 1;
  }

  if (
    row.statusTitle === "Przed zamówieniem" ||
    isProsbaHandoffStatus(row.statusTitle)
  ) {
    return 0;
  }

  return -1;
}

function deriveInformacjaRequestProgress(row: MyOrderRow): MyOrderRequestProgressTrack | null {
  const title = row.statusTitle;
  const submitDate = row.submittedLabel;
  const orderDate = row.orderedAtLabel ?? null;

  if (title === INFORMACJA_FLOW_SALES_STOCK_OUT.statusTitle) {
    return {
      accent: "informacja",
      steps: markSteps(
        [
          { id: "submit", label: "Zgłoszenie", date: submitDate },
          { id: "order", label: "Zamówienie u dostawcy" },
        ],
        0
      ),
    };
  }

  if (title === INFORMACJA_FLOW_SALES_STOCK_OUT_ORDERED.statusTitle) {
    return {
      accent: "informacja",
      steps: markSteps(
        [
          { id: "submit", label: "Zgłoszenie", date: submitDate },
          { id: "order", label: "Zamówienie u dostawcy", date: orderDate },
        ],
        1
      ),
    };
  }

  const viaPanelLabels = [
    { id: "submit", label: "Zgłoszenie", date: submitDate },
    { id: "order", label: "Zamówienie u dostawcy", date: orderDate },
    { id: "warehouse", label: "Magazyn" },
    { id: "notify", label: "Powiadomienie" },
  ] as const;

  if (title === INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle) {
    return {
      accent: "informacja",
      steps: markSteps(viaPanelLabels, 1),
    };
  }

  if (title === INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusTitle) {
    return {
      accent: "informacja",
      steps: markSteps(viaPanelLabels, 2),
    };
  }

  const directLabels = [
    { id: "submit", label: "Zgłoszenie", date: submitDate },
    { id: "warehouse", label: "Magazyn obserwuje" },
    { id: "notify", label: "Powiadomienie" },
  ] as const;

  if (row.acknowledgeMode === "availability" || title === "Dostępne") {
    return {
      accent: "informacja",
      steps: markSteps(directLabels, 2),
    };
  }

  if (isProsbaHandoffStatus(title)) {
    return {
      accent: "informacja",
      steps: markSteps(directLabels, 0),
    };
  }

  if (
    isInformacjaAvailabilityPendingStatusTitle(title) ||
    title === INFORMACJA_FLOW_SALES_DIRECT.statusTitle
  ) {
    return {
      accent: "informacja",
      steps: markSteps(directLabels, 1),
    };
  }

  return null;
}
