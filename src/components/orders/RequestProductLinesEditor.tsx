"use client";

import type { IndividualRequestKind } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import {
  appendProductLine,
  newProductLine,
  removeProductLineAt,
  updateProductLine,
  type ProductLineDraft,
} from "@/components/orders/request-product-lines";
import {
  MAX_BATCH_ORDER_LINES,
  MAX_PRODUCT_TEXT_LEN,
  MAX_QUANTITY_LEN,
  MAX_SYMBOL_LEN,
} from "@/lib/security/text-limits";
import { MAX_CLIENT_NAME_LEN } from "@/lib/orders/sales-client-label";

export function RequestProductLinesEditor({
  lines,
  onChange,
  requestKind,
  minLines = 1,
  addLabel = "+ Dodaj pozycję",
  showClientField = false,
  appearance = "default",
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  /** Pole „Klient” przy składaniu prośby (handlowiec). */
  showClientField?: boolean;
  /** Uproszczony układ w formularzu /prosba */
  appearance?: "default" | "prosba";
}) {
  const canRemove = lines.length > minLines;
  const prosba = appearance === "prosba";
  const showLineLabel = !prosba || lines.length > 1;

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
          <div
            className={cn(
              "grid gap-3",
              prosba
                ? "grid-cols-1"
                : requestKind === "informacja"
                  ? "sm:grid-cols-3"
                  : "sm:grid-cols-4"
            )}
          >
            <Field label="Symbol">
              <Input
                placeholder="np. ABC"
                maxLength={MAX_SYMBOL_LEN}
                value={line.symbol}
                onChange={(e) =>
                  onChange(updateProductLine(lines, index, { symbol: e.target.value }))
                }
              />
            </Field>
            <Field
              label={
                requestKind === "informacja"
                  ? "Produkt (co ma być na stanie)"
                  : "Produkty"
              }
              className={prosba ? undefined : "sm:col-span-2"}
            >
              <Input
                placeholder={
                  requestKind === "informacja"
                    ? "Np. wkręt M6 — interesuje tylko dostępność"
                    : "Opis produktów"
                }
                maxLength={MAX_PRODUCT_TEXT_LEN}
                value={line.product}
                onChange={(e) =>
                  onChange(updateProductLine(lines, index, { product: e.target.value }))
                }
              />
            </Field>
            {requestKind === "zamowienie" ? (
              <Field label="Ilość (wymagane)">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  required
                  maxLength={MAX_QUANTITY_LEN}
                  placeholder="np. 1"
                  value={line.quantity}
                  onChange={(e) =>
                    onChange(updateProductLine(lines, index, { quantity: e.target.value }))
                  }
                />
              </Field>
            ) : null}
          </div>
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

/** Jedna pozycja startowa z stabilnym id (formularze wielowierszowe). */
export function initialProductLines(count = 1): ProductLineDraft[] {
  return Array.from({ length: count }, () => newProductLine());
}
