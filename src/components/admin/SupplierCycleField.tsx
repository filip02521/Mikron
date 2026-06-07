"use client";

import { Field, Input, Select } from "@/components/ui/Field";
import { FieldHintButton } from "@/components/admin/FieldHintButton";
import {
  SUPPLIER_CYCLE_CUSTOM_ID,
  type SupplierCyclePreset,
  matchSupplierCyclePreset,
  supplierCyclePresetById,
} from "@/lib/suppliers/cycle-presets";
import { parseInterval } from "@/lib/orders/dates";

export function SupplierCycleField({
  label,
  hintLabel,
  hintTitle,
  hintContent,
  value,
  onChange,
  presets,
  customPlaceholder,
  disabled,
}: {
  label: string;
  hintLabel: string;
  hintTitle: string;
  hintContent: React.ReactNode;
  value: string;
  onChange: (raw: string) => void;
  presets: SupplierCyclePreset[];
  customPlaceholder: string;
  disabled?: boolean;
}) {
  const selectedId = matchSupplierCyclePreset(value, presets);
  const isCustom = selectedId === SUPPLIER_CYCLE_CUSTOM_ID;
  const parsed = value.trim() ? parseInterval(value) : null;
  const parseOk = !value.trim() || parsed != null || /potrzeb/i.test(value);

  return (
    <Field
      label={
        <span className="inline-flex items-center gap-1">
          {label}
          <FieldHintButton label={hintLabel} title={hintTitle}>
            {hintContent}
          </FieldHintButton>
        </span>
      }
      hint={
        isCustom && value.trim() && !parseOk
          ? "Nie rozpoznano formatu — użyj np. 6, 6 tyg., 2 miesiące."
          : undefined
      }
      state={isCustom && value.trim() && !parseOk ? "warning" : "default"}
    >
      <Select
        disabled={disabled}
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          if (id === SUPPLIER_CYCLE_CUSTOM_ID) {
            if (!isCustom) onChange("");
            return;
          }
          const preset = supplierCyclePresetById(id, presets);
          if (preset) onChange(preset.raw);
        }}
      >
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
        <option value={SUPPLIER_CYCLE_CUSTOM_ID}>Inne (wpisz ręcznie)…</option>
      </Select>
      {isCustom ? (
        <Input
          disabled={disabled}
          className="mt-2"
          placeholder={customPlaceholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          state={value.trim() && !parseOk ? "warning" : "default"}
        />
      ) : null}
    </Field>
  );
}
