import { formatStockPeriodCompact, formatSupplierInterval, locationLabel } from "@/lib/display-labels";
import { orderMethodLabel } from "@/lib/display-labels";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import type { SupplierWithSchedule } from "@/types/database";

type SupplierListFields = Pick<
  SupplierWithSchedule,
  | "location"
  | "notes"
  | "stock_raw"
  | "stock"
  | "interval_raw"
  | "interval_weeks"
  | "order_on_demand"
  | "extra_info"
>;

export function formatSupplierListMeta(s: SupplierListFields): string {
  const method = orderMethodLabel(s.notes);
  const parts = [locationLabel(s.location)];
  if (method && method !== "—") parts.push(method);
  return parts.join(" · ");
}

export function formatSupplierCycleSummary(s: SupplierListFields): string {
  if (isSupplierOrderOnDemand(s)) return "—";
  const interval = formatSupplierInterval(s.interval_raw, s.interval_weeks);
  const stock = formatStockPeriodCompact(
    s.stock_raw,
    s.stock != null ? Number(s.stock) : null
  );
  if (interval !== "—" && stock !== "—") return `${interval} · zapas ${stock}`;
  if (interval !== "—") return interval;
  if (stock !== "—") return `Zapas ${stock}`;
  return "Uzupełnij cykl";
}
