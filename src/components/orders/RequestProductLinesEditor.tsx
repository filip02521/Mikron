"use client";

import { useEffect } from "react";
import type { IndividualRequestKind } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { cn } from "@/lib/cn";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
  updateProductLine,
  type ProductLineDraft,
} from "@/components/orders/request-product-lines";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import { MAX_CLIENT_NAME_LEN } from "@/lib/orders/sales-client-label";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";

export function RequestProductLinesEditor({
  lines,
  onChange,
  requestKind,
  minLines = 1,
  addLabel = "+ Dodaj pozycję",
  showClientField = false,
  appearance = "default",
  suppliers,
  onSupplierResolved,
  onSupplierResolveFeedback,
  unifiedFeedback = false,
  onProductFeedbackChange,
  onConfigFeedbackChange,
  onResolvingSupplierChange,
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  showClientField?: boolean;
  appearance?: "default" | "prosba";
  suppliers?: AppSupplierRef[];
  onSupplierResolved?: (result: {
    supplierId: string;
    supplierName: string;
    documentNumber: string | null;
  }) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  unifiedFeedback?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
}) {
  const canRemove = lines.length > minLines;
  const prosba = appearance === "prosba";
  const showLineLabel = !prosba || lines.length > 1;

  useEffect(() => {
    if (requestKind !== "informacja") return;
    if (!lines.some((l) => l.quantity.trim() !== "")) return;
    onChange(lines.map((l) => ({ ...l, quantity: "" })));
  }, [requestKind, lines, onChange]);

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div
          key={line.id}
          className={cn(
            prosba
              ? "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              : "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3"
          )}
        >
          {showLineLabel ? (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {prosba ? `Produkt ${index + 1}` : `Pozycja ${index + 1}`}
              </span>
              {canRemove ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-700 hover:bg-red-50"
                  onClick={() => onChange(removeProductLineAt(lines, index, minLines))}
                >
                  Usuń
                </Button>
              ) : null}
            </div>
          ) : canRemove ? (
            <div className="mb-2 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-red-700 hover:bg-red-50"
                onClick={() => onChange(removeProductLineAt(lines, index, minLines))}
              >
                Usuń
              </Button>
            </div>
          ) : null}

          <SubiektProductLineFields
            appearance={appearance}
            requestKind={requestKind}
            productFieldClassName={prosba ? undefined : "sm:col-span-2"}
            suppliers={suppliers}
            onSupplierResolved={onSupplierResolved}
            onSupplierResolveFeedback={onSupplierResolveFeedback}
            delegateAlerts={unifiedFeedback}
            onProductFeedbackChange={
              index === lines.length - 1 ? onProductFeedbackChange : undefined
            }
            onConfigFeedbackChange={index === 0 ? onConfigFeedbackChange : undefined}
            onResolvingSupplierChange={
              index === lines.length - 1 ? onResolvingSupplierChange : undefined
            }
            value={{
              symbol: line.symbol,
              product: line.product,
              quantity: line.quantity,
              subiektTwId: line.subiektTwId,
            }}
            onChange={(patch) =>
              onChange(updateProductLine(lines, index, patch))
            }
          />

          {showClientField ? (
            <Field label="Klient (opcjonalnie)" className="mt-2">
              <Input
                placeholder="dla kogo jest ten towar — pojawi się w mailu po dostawie"
                maxLength={MAX_CLIENT_NAME_LEN}
                value={line.clientName ?? ""}
                onChange={(e) =>
                  onChange(
                    updateProductLine(lines, index, { clientName: e.target.value })
                  )
                }
              />
            </Field>
          ) : null}
        </div>
      ))}

      <Button
        type="button"
        variant={prosba ? "secondary" : "ghost"}
        size="sm"
        className={prosba ? "w-full sm:w-auto" : undefined}
        disabled={lines.length >= MAX_BATCH_ORDER_LINES}
        onClick={() => onChange(appendProductLine(lines))}
      >
        {addLabel}
        {lines.length >= MAX_BATCH_ORDER_LINES
          ? ` (maks. ${MAX_BATCH_ORDER_LINES})`
          : ""}
      </Button>
    </div>
  );
}

export function initialProductLines(count = 1): ProductLineDraft[] {
  return Array.from({ length: count }, () => newProductLine());
}
