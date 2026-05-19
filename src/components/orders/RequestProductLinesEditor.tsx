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

export function RequestProductLinesEditor({
  lines,
  onChange,
  requestKind,
  minLines = 1,
  addLabel = "+ Dodaj pozycję",
  showClientField = false,
}: {
  lines: ProductLineDraft[];
  onChange: (lines: ProductLineDraft[]) => void;
  requestKind: IndividualRequestKind;
  minLines?: number;
  addLabel?: string;
  /** Pole „Klient” przy składaniu prośby (handlowiec). */
  showClientField?: boolean;
}) {
  const canRemove = lines.length > minLines;

  return (
    <div className="space-y-3">
      {lines.map((line, index) => (
        <div
          key={line.id}
          className={cn(
            "rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-3",
            "sm:grid-cols-1"
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pozycja {index + 1}
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
          <div
            className={cn(
              "grid gap-3",
              requestKind === "informacja" ? "sm:grid-cols-3" : "sm:grid-cols-4"
            )}
          >
            <Field label="Symbol">
              <Input
                placeholder="np. ABC"
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
              className="sm:col-span-2"
            >
              <Input
                placeholder={
                  requestKind === "informacja"
                    ? "Np. wkręt M6 — interesuje tylko dostępność"
                    : "Opis produktów"
                }
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
        variant="ghost"
        size="sm"
        onClick={() => onChange(appendProductLine(lines))}
      >
        {addLabel}
      </Button>
    </div>
  );
}

/** Jedna pozycja startowa z stabilnym id (formularze wielowierszowe). */
export function initialProductLines(count = 1): ProductLineDraft[] {
  return Array.from({ length: count }, () => newProductLine());
}
