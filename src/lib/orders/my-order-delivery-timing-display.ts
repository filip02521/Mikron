import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { formatPlDate } from "@/lib/display-labels";

export type MyOrderDeliveryTimingTone =
  | "default"
  | "overdue"
  | "low-confidence"
  | "zd-sourced";

export type MyOrderDeliveryTimingDisplay = {
  title: string;
  estimate: string;
  detail: string | null;
  tone: MyOrderDeliveryTimingTone;
  zdDocNumber?: string | null;
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

  const zd = row.zdFulfillment;

  if (row.zdEtaPending) {
    return {
      title: "Sprawdzamy termin w ZD",
      estimate: "Trwa synchronizacja z Subiektem…",
      detail:
        "Szacowany termin z historii dostaw może zostać zastąpiony datą z dokumentu ZD u dostawcy.",
      tone: "low-confidence",
    };
  }

  if (row.zdEtaNoMatch) {
    return {
      title: "Brak terminu w Subiekcie",
      estimate,
      detail:
        "Sprawdziliśmy dokumenty ZD u dostawcy — brak terminu realizacji dla tej pozycji. Poniżej szacunek z historii dostaw.",
      tone: overdue ? "overdue" : "low-confidence",
    };
  }

  if (zd) {
    const synced = zd.syncedAt ? formatPlDate(zd.syncedAt.slice(0, 10)) : null;
    return {
      title: overdue ? "Termin z ZD minął" : "Termin realizacji z ZD",
      estimate,
      detail: synced
        ? `Data z dokumentu ${zd.dokNr} u dostawcy. Zaktualizowano ${synced}.`
        : `Data z dokumentu ${zd.dokNr} u dostawcy.`,
      tone: overdue ? "overdue" : "zd-sourced",
      zdDocNumber: zd.dokNr,
    };
  }

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
