import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

export type MyOrderDeliveryTimingTone = "default" | "overdue" | "low-confidence";

export type MyOrderDeliveryTimingDisplay = {
  title: string;
  estimate: string;
  detail: string | null;
  tone: MyOrderDeliveryTimingTone;
};

/** Rozbija timingLabel z presentera na czytelne części UI. */
export function parseMyOrderTimingLabel(timingLabel: string): {
  estimate: string;
  overdue: boolean;
  lowConfidence: boolean;
} {
  const overdue = /·\s*po terminie/i.test(timingLabel);
  const lowConfidence = /mało historii/i.test(timingLabel);
  const estimate = timingLabel
    .replace(/\s*·\s*po terminie\s*/gi, "")
    .replace(/\s*·\s*mało historii\s*/gi, "")
    .trim();

  return { estimate, overdue, lowConfidence };
}

export function buildMyOrderDeliveryTimingDisplay(
  row: MyOrderRow
): MyOrderDeliveryTimingDisplay | null {
  const raw = row.timingLabel?.trim();
  if (!raw) return null;

  const { estimate, overdue, lowConfidence } = parseMyOrderTimingLabel(raw);
  if (!estimate) return null;

  if (overdue) {
    return {
      title: "Termin u dostawcy minął",
      estimate,
      detail: "Szacowany termin minął — czekamy na dostawę u dostawcy.",
      tone: "overdue",
    };
  }

  if (lowConfidence) {
    return {
      title: "Przewidywany termin dostawy",
      estimate,
      detail: "Mało dostaw w historii — termin jest orientacyjny.",
      tone: "low-confidence",
    };
  }

  return {
    title: "Przewidywany termin dostawy",
    estimate,
    detail: null,
    tone: "default",
  };
}

/** Blok terminu tylko dla zamówień w toku z ETA (nie informacji / archiwum bez postępu). */
export function shouldShowMyOrderExpandedDeliveryTiming(
  row: MyOrderRow,
  showProgress: boolean
): boolean {
  if (!showProgress || row.kind !== "zamowienie") return false;
  if (!row.timingLabel?.trim()) return false;
  if (row.statusTitle === "Do odbioru" || row.statusTitle === "Anulowane") return false;
  if (
    row.acknowledgeMode === "pickup" ||
    row.acknowledgeMode === "availability" ||
    row.acknowledgeMode === "cancel_notice" ||
    row.acknowledgeMode === "cancelled"
  ) {
    return false;
  }
  return buildMyOrderDeliveryTimingDisplay(row) !== null;
}
