"use client";

import { Field, Input } from "@/components/ui/Field";

/** Próg darmowej dostawy (zł netto) — obok minimum zamówienia w karcie dostawcy i w modalu zakupów. */
export function SupplierFreeShippingField({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field
      label="Próg darmowej dostawy"
      className="sm:col-span-2"
      hint="Opcjonalnie - wartość zamówienia netto, od której dostawca wysyła bez kosztu dostawy. Puste = brak progu."
    >
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          disabled={disabled}
          placeholder="np. 1000.00"
          value={value ?? ""}
          onChange={(e) => {
            const parsed = e.target.value === "" ? null : Number(e.target.value);
            onChange(parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null);
          }}
        />
        <span className="w-40 shrink-0 text-sm text-slate-600">zł netto</span>
      </div>
    </Field>
  );
}
