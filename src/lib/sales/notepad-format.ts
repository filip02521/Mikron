import type { SalesPaymentWatch } from "@/types/database";

export function formatPln(value: number | string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = value.slice(0, 10);
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}.${m}.${y}`;
}

export function paymentWatchSubtitle(watch: SalesPaymentWatch): string | null {
  const parts: string[] = [];
  const issued = formatShortDate(watch.zk_issued_at);
  if (issued) parts.push(`Wystawiono ${issued}`);
  if (watch.line_summary?.trim()) parts.push(watch.line_summary.trim());
  return parts.length ? parts.join(" · ") : null;
}
