import type { IndividualOrder } from "@/types/database";
import { cn } from "@/lib/cn";

export function supplierKey(order: IndividualOrder): string {
  return order.supplier?.name?.trim() || "—";
}

/** Indeks grupy dostawcy (0, 1, 2…) dla posortowanej listy. */
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

export function queueSupplierRowClass(
  groupIndex: number,
  options?: {
    variant?: QueueTableVariant;
    isPartial?: boolean;
    isFirstInSupplierGroup?: boolean;
  }
): string {
  const variant = options?.variant ?? "delivery";
  const palette =
    variant === "informacja"
      ? INFORMACJA_GROUP_STYLES[groupIndex % INFORMACJA_GROUP_STYLES.length]
      : DELIVERY_GROUP_STYLES[groupIndex % DELIVERY_GROUP_STYLES.length];

  return cn(
    "border-l-[3px]",
    palette.border,
    options?.isPartial ? "bg-amber-50/85" : palette.bg,
    options?.isFirstInSupplierGroup === false && "border-t border-slate-200/90"
  );
}
