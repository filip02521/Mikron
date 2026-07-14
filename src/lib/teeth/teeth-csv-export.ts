import {
  TEETH_KIND_LABELS,
} from "@/lib/teeth/teeth-catalog";
import { jawRequiredForKind } from "@/lib/teeth/teeth-mould-shape-groups";
import type { TeethSupplierBatchSummary } from "@/lib/teeth/teeth-panel-aggregate";

const JAW_LABELS: Record<string, string> = { upper: "Góra", lower: "Dół" };

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generuje CSV z podsumowania zamówienia u dostawcy.
 * Format: linia produktowa, kolor, fason, szczęka, typ, sztuki
 */
export function teethBatchSummaryToCsv(summary: TeethSupplierBatchSummary): string {
  const header = ["Linia produktowa", "Kolor", "Fason", "Szczęka", "Typ", "Szt."];
  const rows: string[] = [header.map(csvEscape).join(",")];

  for (const block of summary.byProductLine) {
    for (const group of block.mergedGroups) {
      rows.push([
        block.productLineLabel,
        group.color,
        group.mould ?? "",
        jawLabel(group.jaw, group.kind),
        kindLabel(group.kind),
        String(group.count),
      ].map(csvEscape).join(","));
    }
  }

  if (summary.mergedGroups.length > 0 && summary.byProductLine.length === 0) {
    for (const group of summary.mergedGroups) {
      rows.push([
        "Do zamówienia",
        group.color,
        group.mould ?? "",
        jawLabel(group.jaw, group.kind),
        kindLabel(group.kind),
        String(group.count),
      ].map(csvEscape).join(","));
    }
  }

  rows.push("");
  rows.push(csvEscape(`Razem: ${summary.totalPieces} szt. · ${summary.orderCount} prośb`));

  if (summary.ordersMissingSpec > 0) {
    rows.push(csvEscape(`Brak specyfikacji: ${summary.ordersMissingSpec} prośb`));
  }

  return "\uFEFF" + rows.join("\r\n");
}

/**
 * Generuje CSV z listą zamówień per handlowiec.
 * Format: handlowiec, produkt, symbol, kolor, fason, szczęka, typ, szt.
 */
export function teethOrderSpecsToCsv(summary: TeethSupplierBatchSummary): string {
  const header = ["Handlowiec", "Produkt", "Symbol", "Kolor", "Fason", "Szczęka", "Typ", "Szt."];
  const rows: string[] = [header.map(csvEscape).join(",")];

  for (const order of summary.byOrder) {
    if (order.groups.length === 0) {
      rows.push([
        order.salesPersonName ?? "—",
        order.product,
        order.symbol ?? "",
        "—",
        "—",
        "—",
        "—",
        order.quantity,
      ].map(csvEscape).join(","));
      continue;
    }
    for (const group of order.groups) {
      rows.push([
        order.salesPersonName ?? "—",
        order.product,
        order.symbol ?? "",
        group.color,
        group.mould ?? "",
        jawLabel(group.jaw, group.kind),
        kindLabel(group.kind),
        String(group.count),
      ].map(csvEscape).join(","));
    }
  }

  return "\uFEFF" + rows.join("\r\n");
}

function jawLabel(jaw: string | null, kind: string | null): string {
  if (!kind || !jawRequiredForKind(kind as never)) return "—";
  return JAW_LABELS[jaw ?? ""] ?? "—";
}

function kindLabel(kind: string | null): string {
  if (!kind) return "—";
  return TEETH_KIND_LABELS[kind as keyof typeof TEETH_KIND_LABELS] ?? "—";
}
