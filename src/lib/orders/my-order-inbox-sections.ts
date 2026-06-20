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

/** Sekcja u góry listy — wymaga kliknięcia handlowca. */
export const MY_ORDER_ACTION_SECTION_COPY = {
  title: "Potwierdź odbiór z regału",
  hint: "Towar gotowy do odbioru albo sprawa do zamknięcia — potwierdź jednym kliknięciem.",
  icon: "action" as const,
  accent: "emerald" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_INFORMACJA_SECTION_COPY = {
  title: "Sprawdzamy dostępność",
  hint: "Prośby informacyjne — bez zamówienia u dostawcy. Czekasz na odpowiedź z magazynu.",
  icon: "informacja" as const,
  accent: "violet" as const satisfies MyOrderSectionAccent,
};

export const MY_ORDER_PROGRESS_SECTION_COPY: Record<
  MyOrderProgressSectionId,
  { title: string; hint: string; icon: MojeSectionIconKind; accent: MyOrderSectionAccent }
> = {
  ordered_progress: {
    title: "Czekamy na dostawę",
    hint: "Zamówienia już złożone u dostawcy. U góry najbliższy termin — rozwiń wiersz, aby zobaczyć datę z ZD.",
    icon: "zamowienie",
    accent: "slate",
  },
  before_order: {
    title: "Przed zamówieniem",
    hint: "Weryfikacja w dziale dostaw lub czekamy na złożenie zamówienia u dostawcy. Nie musisz nic robić.",
    icon: "before_order",
    accent: "indigo",
  },
};

export const MY_ORDER_PROGRESS_SECTION_EMPTY: Record<MyOrderProgressSectionId, string> = {
  ordered_progress: "Obecnie nie masz zamówień u dostawcy — wszystko jest wcześniej w procesie.",
  before_order: "Obecnie nie masz prośb przed zamówieniem u dostawcy.",
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
