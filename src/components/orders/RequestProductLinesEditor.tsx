"use client";

import { useEffect, useState } from "react";
import type { IndividualRequestKind } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { SubiektClientNameField } from "@/components/subiekt/SubiektClientNameField";
import { SubiektProductLineFields } from "@/components/subiekt/SubiektProductLineFields";
import { ProsbaProductLineCollapsedRow } from "@/components/orders/ProsbaProductLineCollapsedRow";
import { ProsbaProductLineNoteField } from "@/components/orders/ProsbaProductLineNoteField";
import { cn } from "@/lib/cn";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
  updateProductLine,
  type ProductLineDraft,
} from "@/components/orders/request-product-lines";
import { shouldCollapseProsbaLine } from "@/lib/orders/prosba-product-line-ui";
import { ProsbaProductStockSummary } from "@/components/orders/ProsbaProductStockStatus";
import { ProsbaZkQuantityHint } from "@/components/orders/ProsbaProductStockStatus";
import { filterProsbaLinesWithSufficientStock } from "@/lib/orders/prosba-stock-check";
import { useProsbaLinesStockSync } from "@/hooks/useProsbaLinesStockSync";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import {
  assessProsbaLineFields,
  prosbaLineHasFieldIssues,
  prosbaLineHasSubmitBlockers,
  shouldShowProsbaLineFieldValidation,
} from "@/lib/orders/prosba-line-field-validation";
import { MAX_BATCH_ORDER_LINES } from "@/lib/security/text-limits";
import { MAX_CLIENT_NAME_LEN } from "@/lib/orders/sales-client-label";
import type { AppSupplierRef } from "@/lib/subiekt/match-supplier";
import type { SubiektFeedback } from "@/lib/subiekt/feedback";
import { ProsbaOptionalSection } from "@/components/orders/ProsbaOptionalSection";
import { PROSBA_OPTIONAL_SECTION_COPY } from "@/lib/orders/prosba-optional-section-copy";
import { SubiektOfflineHint } from "@/components/subiekt/SubiektOfflineHint";
import {
  copyProsbaLineNoteToAllLines,
} from "@/lib/orders/prosba-line-note-copy";

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
  liveValidation = false,
  showLineNotes,
  typeaheadSize = "default",
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  showClientField?: boolean;
  /** Układ handlowca (/prosba) — zwijanie linii, checklista; używany też w modalach panelu dziennego. */
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
  /** Walidacja na żywo — pola z brakami bez czekania na klik „Wyślij”. */
  liveValidation?: boolean;
  /** Notatka per pozycja (panel dzienny) — domyślnie przy `appearance=prosba`. */
  showLineNotes?: boolean;
  /** Wyższa lista podpowiedzi Subiekta / dostawcy w modalach. */
  typeaheadSize?: "default" | "comfortable";
}) {
  const canRemove = lines.length > minLines;
  const prosba = appearance === "prosba";
  const lineNotes = showLineNotes ?? prosba;
  const copyNoteLines = prosba ? copyProsbaLineNoteToAllLines(lines) : null;
  const showLineLabel = !prosba || lines.length > 1;
  const wrapLine = prosba ? lines.length > 1 : true;

  const [focusedLineId, setFocusedLineId] = useState(
    () => lines[lines.length - 1]?.id ?? ""
  );
  const activeLineId = lines.some((line) => line.id === focusedLineId)
    ? focusedLineId
    : (lines[lines.length - 1]?.id ?? "");
  const [subiektOfflineFeedback, setSubiektOfflineFeedback] =
    useState<SubiektFeedback | null>(null);
  const visibleSubiektOfflineFeedback = prosba ? subiektOfflineFeedback : null;
  const teethExemptTwIds = useTeethExemptTwIds();
  const stockChecksEnabled = requestKind === "zamowienie";
  const sufficientStockCount = stockChecksEnabled
    ? filterProsbaLinesWithSufficientStock(lines, requestKind, teethExemptTwIds).length
    : 0;

  useProsbaLinesStockSync(lines, onChange, requestKind, stockChecksEnabled, teethExemptTwIds);

  useEffect(() => {
    if (!prosba) return;
    void (async () => {
      const { actionSubiektSuggestionsEnabled } = await import("@/app/actions/subiekt");
      const r = await actionSubiektSuggestionsEnabled();
      setSubiektOfflineFeedback(r.enabled ? null : (r.feedback ?? null));
    })();
  }, [prosba]);

  const validationFocusKey =
    validationAttempted && prosba
      ? `${requestKind}\0${lines.map((line) => line.id).join("\0")}`
      : "";
  const [appliedValidationFocusKey, setAppliedValidationFocusKey] = useState("");
  if (validationFocusKey && validationFocusKey !== appliedValidationFocusKey) {
    const idx = lines.findIndex((line) => {
      const fields = assessProsbaLineFields(line, requestKind, "strict");
      return prosbaLineHasFieldIssues(fields);
    });
    if (idx >= 0) {
      setAppliedValidationFocusKey(validationFocusKey);
      setFocusedLineId(lines[idx]!.id);
    }
  }

  useEffect(() => {
    if (requestKind !== "informacja") return;
    if (!lines.some((l) => l.quantity.trim() !== "")) return;
    onChange(lines.map((l) => ({ ...l, quantity: "" })));
  }, [requestKind, lines, onChange]);

  const addLine = () => {
    const next = appendProductLine(lines);
    onChange(next);
    setFocusedLineId(next[next.length - 1]!.id);
  };

  const removeLine = (index: number) => {
    const removedId = lines[index]?.id;
    const next = removeProductLineAt(lines, index, minLines);
    onChange(next);
    if (removedId === activeLineId) {
      setFocusedLineId(next[next.length - 1]?.id ?? "");
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
      {visibleSubiektOfflineFeedback ? (
        <div className="flex justify-end">
          <SubiektOfflineHint feedback={visibleSubiektOfflineFeedback} />
        </div>
      ) : null}

      {sufficientStockCount > 1 ? (
        <ProsbaProductStockSummary count={sufficientStockCount} />
      ) : null}

      {segments.map((segment) => {
        if (segment.kind === "collapsed") {
          return (
            <div
              key={segment.indexes.map((i) => lines[i]!.id).join("|")}
              className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
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
                          (validationAttempted || liveValidation) &&
                          prosbaLineHasSubmitBlockers(line, requestKind)
                        }
                        onEdit={() => setFocusedLineId(line.id)}
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
            liveValidation,
            lineCount: lines.length,
            requestKind,
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
                  ? "rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                  : "rounded-md border border-dashed border-slate-200 bg-slate-50/50 p-3"
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
              typeaheadSize={typeaheadSize}
              fieldValidation={fieldValidation}
              lineIndex={index}
              value={{
                symbol: line.symbol,
                mikranCode: line.mikranCode,
                product: line.product,
                quantity: line.quantity,
                subiektTwId: line.subiektTwId,
                onHand: line.onHand,
                reserved: line.reserved,
                available: line.available,
                stockSource: line.stockSource,
                source: line.source,
              }}
              onChange={(patch) =>
                onChange(updateProductLine(lines, index, patch))
              }
            />

            {prosba ? (
              <ProsbaZkQuantityHint line={line} requestKind={requestKind} className="mt-2" />
            ) : null}

            {showClientField ? (
              prosba && lines.length === 1 ? (
                <ProsbaOptionalSection
                  kind="client"
                  title={PROSBA_OPTIONAL_SECTION_COPY.client.title}
                  description={PROSBA_OPTIONAL_SECTION_COPY.client.description}
                  defaultOpen={Boolean(line.clientName?.trim() || line.clientKhId)}
                  teaser={line.clientName?.trim() || null}
                  className="mt-2"
                >
                  <SubiektClientNameField
                    maxLength={MAX_CLIENT_NAME_LEN}
                    value={line.clientName ?? ""}
                    clientKhId={line.clientKhId ?? null}
                    onChange={({ clientName, clientKhId }) =>
                      onChange(updateProductLine(lines, index, { clientName, clientKhId }))
                    }
                  />
                </ProsbaOptionalSection>
              ) : (
                <Field label="Klient (opcjonalnie)" className={wrapLine ? "mt-2" : undefined}>
                  <SubiektClientNameField
                    maxLength={MAX_CLIENT_NAME_LEN}
                    value={line.clientName ?? ""}
                    clientKhId={line.clientKhId ?? null}
                    onChange={({ clientName, clientKhId }) =>
                      onChange(updateProductLine(lines, index, { clientName, clientKhId }))
                    }
                  />
                </Field>
              )
            ) : null}

            {lineNotes ? (
              <ProsbaProductLineNoteField
                id={`prosba-line-note-${line.id}`}
                value={line.requestNote ?? ""}
                onChange={(requestNote) =>
                  onChange(updateProductLine(lines, index, { requestNote }))
                }
                className={showClientField || wrapLine ? "mt-2" : undefined}
              />
            ) : null}
          </div>
        );
      })}

      {copyNoteLines ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-0 py-1 text-xs font-medium text-indigo-700 hover:bg-transparent hover:text-indigo-900"
          onClick={() => onChange(copyNoteLines)}
        >
          {PROSBA_OPTIONAL_SECTION_COPY.lineNote.copyToAllLines}
        </Button>
      ) : null}

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
