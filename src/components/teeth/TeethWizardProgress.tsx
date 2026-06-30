"use client";

import { useMemo } from "react";
import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  expandTeethDetails,
  isTeethDetailComplete,
  resolveTeethCatalogFromDraft,
  manufacturerForProductLine,
  type TeethManufacturer,
} from "@/lib/teeth/teeth-catalog";
import {
  teethProsbaDetailClass,
  teethProsbaIncompleteIconClass,
  teethProsbaIncompleteTitleClass,
  teethProsbaShellIncompleteClass,
  teethProsbaStatusRowClass,
} from "@/lib/teeth/teeth-prosba-ui";
import { IconClipboardList } from "@/components/icons/StrokeIcons";

export type TeethLineStatus = {
  lineId: string;
  index: number;
  productName: string;
  manufacturer: TeethManufacturer;
  quantity: number;
  completed: number;
  total: number;
  isComplete: boolean;
  teethDetails?: ProductLineDraft["teethDetails"];
};

export function useTeethLinesStatus(lines: ProductLineDraft[]): {
  teethLines: TeethLineStatus[];
  completedCount: number;
  totalCount: number;
} {
  return useMemo(() => {
    const teethLines: TeethLineStatus[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const catalog = resolveTeethCatalogFromDraft(line);
      if (!catalog) continue;
      const qty = line.teethDetails?.length ?? 0;
      const expanded = expandTeethDetails(line.teethDetails, Math.max(qty, 1));
      const completed = expanded.filter((d) =>
        isTeethDetailComplete(d, catalog),
      ).length;
      const effectiveTotal = qty > 0 ? qty : Math.max(1, parseInt(line.quantity, 10) || 1);
      teethLines.push({
        lineId: line.id,
        index: i,
        productName: line.product?.trim() || line.symbol?.trim() || line.mikranCode?.trim() || "Produkt",
        manufacturer: line.teethManufacturer ?? manufacturerForProductLine(catalog.productLine),
        quantity: effectiveTotal,
        completed: qty > 0 ? completed : 0,
        total: effectiveTotal,
        isComplete: qty > 0 && completed === qty,
        teethDetails: line.teethDetails,
      });
    }
    return {
      teethLines,
      completedCount: teethLines.filter((l) => l.isComplete).length,
      totalCount: teethLines.length,
    };
  }, [lines]);
}

/** Tylko przy wielu pozycjach zębowych — skrót „co jeszcze brakuje”. */
export function TeethProgressBadge({
  incompleteCount,
}: {
  incompleteCount: number;
}) {
  if (incompleteCount < 1) return null;

  return (
    <div
      role="status"
      className={`${teethProsbaStatusRowClass} ${teethProsbaShellIncompleteClass}`}
    >
      <IconClipboardList
        size={18}
        strokeWidth={2.25}
        className={teethProsbaIncompleteIconClass}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={teethProsbaIncompleteTitleClass}>Uzupełnij listy zębów</p>
        <p className={teethProsbaDetailClass}>
          {incompleteCount}{" "}
          {incompleteCount === 1 ? "pozycja wymaga" : "pozycje wymagają"} skonfigurowanej listy —
          rozwiń pozycję i otwórz listę zębów.
        </p>
      </div>
    </div>
  );
}
