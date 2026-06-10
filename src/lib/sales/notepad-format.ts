import type { SalesZkWatch } from "@/types/database";
import { normalizeZkQuery, zkDocumentStatusLabel } from "@/lib/subiekt/zk-document";

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

/** Numer ZK bez prefiksu — czytelniejszy w wąskiej liście. */
export function formatZkWatchDisplayNumber(zkNumber: string): string {
  return normalizeZkQuery(zkNumber).replace(/\s+/g, " ").trim() || zkNumber.trim();
}

function readSnapshotStatusLabel(watch: SalesZkWatch): string | null {
  const snap = watch.subiekt_snapshot as { dok_Status?: number | null } | null;
  return zkDocumentStatusLabel(snap?.dok_Status ?? null);
}

export function zkWatchSubtitle(
  watch: SalesZkWatch,
  options?: { omitLineSummary?: boolean }
): string | null {
  const parts: string[] = [];
  const issued = formatShortDate(watch.zk_issued_at);
  if (issued) parts.push(`Wystawiono ${issued}`);
  if (!options?.omitLineSummary && watch.line_summary?.trim()) {
    parts.push(watch.line_summary.trim());
  }
  const status = readSnapshotStatusLabel(watch);
  if (status && status !== "Aktywne") parts.push(`Status: ${status}`);
  return parts.length ? parts.join(" · ") : null;
}

export function zkWatchStatusLabel(watch: SalesZkWatch): string | null {
  const label = readSnapshotStatusLabel(watch);
  if (!label || label === "Aktywne") return null;
  return label;
}
