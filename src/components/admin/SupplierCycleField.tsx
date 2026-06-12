"use client";

import { useState } from "react";
import { Field, Input, Select } from "@/components/ui/Field";
import { FieldHintButton } from "@/components/admin/FieldHintButton";
import {
  SUPPLIER_CYCLE_CUSTOM_ID,
  type SupplierCyclePreset,
  matchSupplierCyclePreset,
  supplierCyclePresetById,
} from "@/lib/suppliers/cycle-presets";
import { parseInterval } from "@/lib/orders/dates";

function initialCustomMode(value: string, presets: SupplierCyclePreset[]): boolean {
  return matchSupplierCyclePreset(value, presets) === SUPPLIER_CYCLE_CUSTOM_ID;
}

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
  const [customMode, setCustomMode] = useState(() => initialCustomMode(value, presets));
  const matchedPresetId = matchSupplierCyclePreset(value, presets);
  const selectedId = customMode ? SUPPLIER_CYCLE_CUSTOM_ID : matchedPresetId;
  const isCustom = customMode;
  const parsed = value.trim() ? parseInterval(value) : null;
  const parseOk = !value.trim() || parsed != null || /potrzeb/i.test(value);
  const numericOnly = isCustom && /^\d+$/.test(value.trim());

  const fieldHint =
    isCustom && value.trim() && !parseOk
      ? "Nie rozpoznano formatu — użyj np. 6, 6 tyg., 4 miesiące."
      : numericOnly
        ? "Sama liczba oznacza tygodnie. Dla miesięcy dopisz „miesiące”, np. 4 miesiące."
        : undefined;

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
      hint={fieldHint}
      state={isCustom && value.trim() && !parseOk ? "warning" : "default"}
    >
      <Select
        disabled={disabled}
        value={selectedId}
        onChange={(e) => {
          const id = e.target.value;
          if (id === SUPPLIER_CYCLE_CUSTOM_ID) {
            setCustomMode(true);
            if (!isCustom) onChange("");
            return;
          }
          setCustomMode(false);
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
