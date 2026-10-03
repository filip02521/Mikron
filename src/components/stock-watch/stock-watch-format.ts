import type { StockWatchRule, StockWatchStatus } from "@/lib/stock-watch/analysis";

const plnFormatter = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

const qtyFormatter = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 1 });
const rateFormatter = new Intl.NumberFormat("pl-PL", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export function formatPln(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return plnFormatter.format(value);
}

export function formatQtyPl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "-";
  return qtyFormatter.format(value);
}

/** Rotacja szt/dzień — małe wartości z dwoma miejscami (0,07 szt/d). */
export function formatVelocity(value: number): string {
  if (!(value > 0)) return "0";
  return rateFormatter.format(value);
}

/** „starczy na 4 dni” / „< 1 dzień” / „brak”. */
export function formatCover(daysOfCover: number | null, status: StockWatchStatus): string {
  if (status === "out_of_stock") return "brak towaru";
  if (daysOfCover == null) return "bez sprzedaży";
  if (daysOfCover < 1) return "< 1 dzień";
  const days = Math.floor(daysOfCover);
  if (days === 1) return "1 dzień";
  if (days > 365) return "> rok";
  return `${days} dni`;
}

export function formatRunOutDate(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = date.split("-");
  return y && m && d ? `${d}.${m}` : null;
}

export const STOCK_WATCH_STATUS_META: Record<
  StockWatchStatus,
  { label: string; badge: "danger" | "warning" | "success" | "default"; dot: string; bar: string }
> = {
  out_of_stock: { label: "Brak", badge: "danger", dot: "bg-red-600", bar: "bg-red-500" },
  critical: { label: "≤ 48 h", badge: "danger", dot: "bg-red-500", bar: "bg-red-400" },
  warning: { label: "Poniżej celu", badge: "warning", dot: "bg-amber-500", bar: "bg-amber-400" },
  ok: { label: "W normie", badge: "success", dot: "bg-emerald-500", bar: "bg-emerald-500" },
  no_sales: { label: "Bez sprzedaży", badge: "default", dot: "bg-slate-300", bar: "bg-slate-300" },
};

export const STOCK_WATCH_RULE_META: Record<
  StockWatchRule,
  { label: string; short: string; description: string }
> = {
  standard: {
    label: "Standard",
    short: "Standard",
    description: "Pełny automat - alerty i propozycje zapasu.",
  },
  on_request: {
    label: "Na prośbę",
    short: "Na prośbę",
    description: "Zamawiamy tylko pod klienta - bez zapasu i bez alertów.",
  },
  excluded: {
    label: "Wykluczone",
    short: "Wyklucz",
    description: "Ignorowane - nie krzyczy, że brakuje.",
  },
};
