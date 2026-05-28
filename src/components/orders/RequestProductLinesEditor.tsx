"use client";

import { useEffect, useState } from "react";
import type { IndividualRequestKind } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { ProsbaProductLineCollapsedRow } from "@/components/orders/ProsbaProductLineCollapsedRow";
import { cn } from "@/lib/cn";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
  updateProductLine,
  type ProductLineDraft,
} from "@/components/orders/request-product-lines";
import { shouldCollapseProsbaLine } from "@/lib/orders/prosba-product-line-ui";
import {
  assessProsbaLineFields,
  prosbaLineHasFieldIssues,
  shouldShowProsbaLineFieldValidation,
} from "@/lib/orders/prosba-line-field-validation";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import { MAX_CLIENT_NAME_LEN } from "@/lib/orders/sales-client-label";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { SubiektOfflineHint } from "@/components/subiekt/SubiektOfflineHint";

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
  onSupplierMappingMissing,
  unifiedFeedback = false,
  onProductFeedbackChange,
  onConfigFeedbackChange,
  onResolvingSupplierChange,
  deferSupplierResolve = false,
  validationAttempted = false,
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  showClientField?: boolean;
  /** Układ handlowca (/prosba, edycja własnej prośby) — zwijanie linii, checklista, tryb ręczny. Nie używać w modalach zakupów. */
  appearance?: "default" | "prosba";
  suppliers?: AppSupplierRef[];
  onSupplierResolved?: (result: {
    supplierId: string;
    supplierName: string;
    documentNumber: string | null;
  }) => void;
  onSupplierResolveFeedback?: (feedback: SubiektFeedback | null) => void;
  onSupplierMappingMissing?: () => void;
  unifiedFeedback?: boolean;
  onProductFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onConfigFeedbackChange?: (feedback: SubiektFeedback | null) => void;
  onResolvingSupplierChange?: (resolving: boolean) => void;
  deferSupplierResolve?: boolean;
  /** Po nieudanej próbie wysłania — podświetlenie braków we wszystkich pozycjach. */
  validationAttempted?: boolean;
}) {
  const canRemove = lines.length > minLines;
  const prosba = appearance === "prosba";
  const showLineLabel = !prosba || lines.length > 1;
  const wrapLine = prosba ? lines.length > 1 : true;

  const [activeLineId, setActiveLineId] = useState(
    () => lines[lines.length - 1]?.id ?? ""
  );
  const [subiektOfflineFeedback, setSubiektOfflineFeedback] =
    useState<SubiektFeedback | null>(null);

  useEffect(() => {
    if (!prosba) {
      setSubiektOfflineFeedback(null);
      return;
    }
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setSubiektOfflineFeedback(r.enabled ? null : (r.feedback ?? null));
    })();
  }, [prosba]);

  useEffect(() => {
    if (!lines.length) return;
    if (!lines.some((l) => l.id === activeLineId)) {
      setActiveLineId(lines[lines.length - 1]!.id);
    }
  }, [lines, activeLineId]);

  useEffect(() => {
    if (requestKind !== "informacja") return;
    if (!lines.some((l) => l.quantity.trim() !== "")) return;
    onChange(lines.map((l) => ({ ...l, quantity: "" })));
  }, [requestKind, lines, onChange]);

  useEffect(() => {
    if (!validationAttempted || !prosba) return;
    const idx = lines.findIndex((line) => {
      const fields = assessProsbaLineFields(line, requestKind, "strict");
      return prosbaLineHasFieldIssues(fields);
    });
    if (idx >= 0) setActiveLineId(lines[idx]!.id);
  }, [validationAttempted, prosba, lines, requestKind]);

  const addLine = () => {
    const next = appendProductLine(lines);
    onChange(next);
    setActiveLineId(next[next.length - 1]!.id);
  };

  const removeLine = (index: number) => {
    const removedId = lines[index]?.id;
    const next = removeProductLineAt(lines, index, minLines);
    onChange(next);
    if (removedId === activeLineId) {
      setActiveLineId(next[next.length - 1]?.id ?? "");
    }
  };

  type Segment =
    | { kind: "collapsed"; indexes: number[] }
    | { kind: "expanded"; index: number };

  const segments: Segment[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const collapsed =
      prosba &&
      shouldCollapseProsbaLine(line, requestKind, lines.length, activeLineId);
    if (collapsed) {
      const last = segments[segments.length - 1];
      if (last?.kind === "collapsed") {
        last.indexes.push(index);
      } else {
        segments.push({ kind: "collapsed", indexes: [index] });
      }
    } else {
      segments.push({ kind: "expanded", index });
    }
  }

  return (
    <div className="space-y-3">
      {prosba && subiektOfflineFeedback ? (
        <div className="flex justify-end">
          <SubiektOfflineHint feedback={subiektOfflineFeedback} />
        </div>
      ) : null}

      {segments.map((segment) => {
        if (segment.kind === "collapsed") {
          return (
            <div
              key={segment.indexes.map((i) => lines[i]!.id).join("|")}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <ul className="divide-y divide-slate-100">
                {segment.indexes.map((index) => {
                  const line = lines[index]!;
                  return (
                    <li key={line.id}>
                      <ProsbaProductLineCollapsedRow
                        index={index}
                        line={line}
                        requestKind={requestKind}
                        canRemove={canRemove}
                        hasFieldIssues={
                          validationAttempted &&
                          prosbaLineHasFieldIssues(
                            assessProsbaLineFields(line, requestKind, "strict")
                          )
                        }
                        onEdit={() => setActiveLineId(line.id)}
                        onRemove={() => removeLine(index)}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        }

        const index = segment.index;
        const line = lines[index]!;
        const isActive = line.id === activeLineId;
        const showFieldValidation =
          prosba &&
          shouldShowProsbaLineFieldValidation(line, {
            active: isActive,
            validationAttempted,
            lineCount: lines.length,
          });
        const fieldValidation = showFieldValidation
          ? assessProsbaLineFields(
              line,
              requestKind,
              validationAttempted ? "strict" : "soft"
            )
          : undefined;

        return (
          <div
            key={line.id}
            className={cn(
              wrapLine
                ? prosba
                  ? "rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  : "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3"
                : "space-y-3"
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
                    onClick={() => removeLine(index)}
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
                  onClick={() => removeLine(index)}
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
              onSupplierMappingMissing={onSupplierMappingMissing}
              delegateAlerts={unifiedFeedback}
              onProductFeedbackChange={
                isActive ? onProductFeedbackChange : undefined
              }
              onConfigFeedbackChange={index === 0 ? onConfigFeedbackChange : undefined}
              onResolvingSupplierChange={
                isActive ? onResolvingSupplierChange : undefined
              }
              deferSupplierResolve={deferSupplierResolve}
              fieldValidation={fieldValidation}
              lineIndex={index}
              value={{
                symbol: line.symbol,
                mikranCode: line.mikranCode,
                product: line.product,
                quantity: line.quantity,
                subiektTwId: line.subiektTwId,
              }}
              onChange={(patch) =>
                onChange(updateProductLine(lines, index, patch))
              }
            />

            {showClientField ? (
              <Field label="Klient (opcjonalnie)" className={wrapLine ? "mt-2" : undefined}>
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
        );
      })}

      <Button
        type="button"
        variant={prosba ? "secondary" : "ghost"}
        size="sm"
        className={prosba ? "w-full sm:w-auto" : undefined}
        disabled={lines.length >= MAX_BATCH_ORDER_LINES}
        onClick={addLine}
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
