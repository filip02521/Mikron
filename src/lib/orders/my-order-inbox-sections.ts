import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import type { MojeSectionIconKind } from "@/components/icons/StrokeIcons";
import { isProsbaHandoffStatus, sortMyOrderRows } from "@/lib/orders/my-order-sales-ui";
import { sortOrderedProgressByDelivery } from "@/lib/orders/my-order-delivery-urgency";

/** Sekcja listy „w toku” dla zamówień — przed vs po złożeniu u dostawcy. */
export type MyOrderProgressSectionId = "before_order" | "ordered_progress";

/** Kolejność sekcji na liście (od góry) — chronologicznie: bliżej odbioru wyżej. */
export const MY_ORDER_PROGRESS_SECTION_ORDER: MyOrderProgressSectionId[] = [
  "ordered_progress",
  "before_order",
];

import type { MyOrderSectionAccent } from "@/lib/orders/my-order-section-accent";
import { mojeSectionDomId } from "@/lib/orders/moje-section-focus";

/** Sekcja u góry listy — wymaga kliknięcia handlowca. */
export const MY_ORDER_ACTION_SECTION_COPY = {
  title: "Potwierdź odbiór z regału",
  hint: "Towar czeka na regale albo sprawa jest do zamknięcia - potwierdź jednym kliknięciem.",
  icon: "action" as const,
  accent: "emerald" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_TEETH_ACTION_SECTION_COPY = {
  title: "Potwierdź odbiór zębów",
  hint: "Magazyn doręcza zęby osobiście (nie na regał) - potwierdź odbiór.",
  icon: "teeth" as const,
  accent: "violet" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_MIXED_ACTION_SECTION_COPY = {
  title: "Potwierdź odbiór (zęby i towar)",
  hint: "Zęby i towar z regału potwierdzasz osobno.",
  icon: "mixed-pickup" as const,
  accent: "indigo" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_DISMISS_SECTION_COPY = {
  title: "Anulowania do potwierdzenia",
  hint: "Potwierdź, żeby usunąć wpis z listy.",
  icon: "dismiss" as const,
  accent: "slate" as const satisfies MyOrderSectionAccent,
};

export const MOJE_TEETH_ACTION_SECTION_ID = mojeSectionDomId("teeth");
export const MOJE_MIXED_ACTION_SECTION_ID = mojeSectionDomId("mixed-pickup");

export const MY_ORDER_INFORMACJA_SECTION_COPY = {
  title: "Sprawdzamy dostępność",
  hint: "Bez zamówienia u dostawcy - odpowie magazyn.",
  icon: "informacja" as const,
  accent: "violet" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_PROGRESS_SECTION_COPY: Record<
  MyOrderProgressSectionId,
  { title: string; hint: string; icon: MojeSectionIconKind; accent: MyOrderSectionAccent }
> = {
  ordered_progress: {
    title: "Czekamy na dostawę",
    hint: "Zamówione u dostawcy - najbliższy termin u góry.",
    icon: "zamowienie",
    accent: "slate",
  },
  before_order: {
    title: "Przed zamówieniem",
    hint: "Dział dostaw sprawdza lub zamawia - nie musisz nic robić.",
    icon: "before_order",
    accent: "indigo",
  },
};

export const MY_ORDER_PROGRESS_SECTION_EMPTY: Record<MyOrderProgressSectionId, string> = {
  ordered_progress:
    "Obecnie nie masz zamówień u dostawcy - wszystkie prośby są na wcześniejszym etapie.",
  before_order: "Obecnie nie masz próśb przed zamówieniem u dostawcy.",
};

/** Czy prośba jest jeszcze przed realnym zamówieniem u dostawcy. */
export function myOrderProgressSection(row: MyOrderRow): MyOrderProgressSectionId {
  if (
    row.statusTitle === "Przed zamówieniem" ||
    row.statusTitle === "Czekamy na zamówienie u dostawcy" ||
    isProsbaHandoffStatus(row.statusTitle)
  ) {
    return "before_order";
  }
  return "ordered_progress";
}

export function partitionMyOrderProgressRows(rows: MyOrderRow[]): {
  beforeOrder: MyOrderRow[];
  orderedProgress: MyOrderRow[];
} {
  const beforeOrder: MyOrderRow[] = [];
  const orderedProgress: MyOrderRow[] = [];
  for (const row of rows) {
    if (myOrderProgressSection(row) === "before_order") {
      beforeOrder.push(row);
    } else {
      orderedProgress.push(row);
    }
  }
  return {
    beforeOrder: sortMyOrderRows(beforeOrder),
    orderedProgress: sortOrderedProgressByDelivery(orderedProgress),
  };
}
