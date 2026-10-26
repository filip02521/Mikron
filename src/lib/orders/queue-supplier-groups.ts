import type { IndividualOrder } from "@/types/database";
import { cn } from "@/lib/cn";

export function supplierKey(order: IndividualOrder): string {
  return order.supplier?.name?.trim() || "-";
}

export type SupplierOrderGroup = {
  supplierKey: string;
  orders: IndividualOrder[];
};

/** Id pozycji w bloku tego samego dostawcy (lista posortowana po dostawcy). */
export function orderIdsInSupplierGroup(
  orders: IndividualOrder[],
  startIndex: number
): string[] {
  const key = supplierKey(orders[startIndex]!);
  const ids: string[] = [];
  for (let i = startIndex; i < orders.length; i++) {
    if (supplierKey(orders[i]!) !== key) break;
    ids.push(orders[i]!.id);
  }
  return ids;
}

export function groupOrdersBySupplier(orders: IndividualOrder[]): SupplierOrderGroup[] {
  const groups: SupplierOrderGroup[] = [];
  for (const order of orders) {
    const key = supplierKey(order);
    const last = groups[groups.length - 1];
    if (last && last.supplierKey === key) {
      last.orders.push(order);
    } else {
      groups.push({ supplierKey: key, orders: [order] });
    }
  }
  return groups;
}

export function supplierGroupIndexByOrderId(
  orders: IndividualOrder[]
): Map<string, number> {
  const map = new Map<string, number>();
  let groupIndex = -1;
  let lastKey = "";
  for (const o of orders) {
    const key = supplierKey(o);
    if (key !== lastKey) {
      groupIndex++;
      lastKey = key;
    }
    map.set(o.id, groupIndex);
  }
  return map;
}

// Jeden spokojny układ: wiersz dostawcy biały, jego pozycje na lekkim szarym tle. Grupy rozdziela linia,
// nie kolor tła — naprzemienne barwy czytały się jak stan, którego nie ma (DESIGN.md → Cards).
const DELIVERY_GROUP_STYLES = [
  { headerBg: "bg-white hover:bg-slate-50/70", itemBg: "bg-slate-50/60" },
] as const;

const INFORMACJA_GROUP_STYLES = [
  { headerBg: "bg-white hover:bg-slate-50/70", itemBg: "bg-sky-50/40" },
] as const;

type QueueTableVariant = "delivery" | "informacja";

function supplierGroupPalette(groupIndex: number, variant: QueueTableVariant) {
  return variant === "informacja"
    ? INFORMACJA_GROUP_STYLES[groupIndex % INFORMACJA_GROUP_STYLES.length]
    : DELIVERY_GROUP_STYLES[groupIndex % DELIVERY_GROUP_STYLES.length];
}

/** Tło wiersza (na `<tr>`). Pasek koloru — na pierwszej `<td>` przez `queueSupplierLeadingCellClass`. */
export function queueSupplierRowClass(
  groupIndex: number,
  options?: {
    variant?: QueueTableVariant;
    isPartial?: boolean;
    isFirstInSupplierGroup?: boolean;
    isHeader?: boolean;
    isLastInGroup?: boolean;
    stripeIndex?: number;
  }
): string {
  const variant = options?.variant ?? "delivery";
  const palette = supplierGroupPalette(options?.stripeIndex ?? groupIndex, variant);
  const isHeader = options?.isHeader ?? false;

  return cn(
    options?.isPartial ? "bg-amber-50/85" : isHeader ? palette.headerBg : palette.itemBg,
    isHeader && "border-t border-slate-100",
    !isHeader && options?.isFirstInSupplierGroup === true && "border-t border-slate-200/80",
    !isHeader && options?.isFirstInSupplierGroup === false && "border-t border-slate-200/60",
    !isHeader && options?.isLastInGroup === true && "border-b border-slate-200/60"
  );
}

/**
 * Dawniej lewy kolorowy pasek grupy. DESIGN.md nie dopuszcza bocznych pasków na wierszach — grupy rozdziela
 * linia i tło pozycji — więc zwraca pustą klasę; zostaje, żeby wywołania (kolejka, zęby) się nie zmieniały.
 */
export function queueSupplierLeadingCellClass(
  _groupIndex: number,
  _options?: { variant?: QueueTableVariant; isHeader?: boolean; stripeIndex?: number }
): string {
  return "";
}
