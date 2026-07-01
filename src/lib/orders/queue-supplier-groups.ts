import type { IndividualOrder } from "@/types/database";
import { cn } from "@/lib/cn";

export function supplierKey(order: IndividualOrder): string {
  return order.supplier?.name?.trim() || "—";
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

const DELIVERY_GROUP_STYLES = [
  { bg: "bg-white", border: "border-l-violet-500" },
  { bg: "bg-slate-50", border: "border-l-slate-500" },
  { bg: "bg-violet-50/80", border: "border-l-violet-400" },
  { bg: "bg-indigo-50/60", border: "border-l-indigo-400" },
] as const;

const INFORMACJA_GROUP_STYLES = [
  { bg: "bg-white", border: "border-l-sky-500" },
  { bg: "bg-sky-50/80", border: "border-l-sky-400" },
  { bg: "bg-slate-50", border: "border-l-slate-400" },
  { bg: "bg-cyan-50/50", border: "border-l-cyan-500" },
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
    stripeIndex?: number;
  }
): string {
  const variant = options?.variant ?? "delivery";
  const palette = supplierGroupPalette(options?.stripeIndex ?? groupIndex, variant);

  return cn(
    options?.isPartial ? "bg-amber-50/85" : palette.bg,
    options?.isFirstInSupplierGroup === false && "border-t border-slate-200/90"
  );
}

/** Lewy pasek grupy — musi być na pierwszej komórce wiersza (border na `<tr>` nie renderuje się przy border-collapse). */
export function queueSupplierLeadingCellClass(
  groupIndex: number,
  options?: { variant?: QueueTableVariant; stripeIndex?: number }
): string {
  const variant = options?.variant ?? "delivery";
  const palette = supplierGroupPalette(options?.stripeIndex ?? groupIndex, variant);
  return cn("border-l-[3px]", palette.border);
}
