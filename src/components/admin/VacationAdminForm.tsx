"use client";

import { Field, Input, Select } from "@/components/ui/Field";

export type VacationAdminFormState = {
  id?: string;
  supplier_id: string;
  start_date: string;
  end_date: string;
  last_order_date: string;
  active: boolean;
};

export function emptyVacationAdminForm(): VacationAdminFormState {
  return {
    supplier_id: "",
    start_date: "",
    end_date: "",
    last_order_date: "",
    active: true,
  };
}

export function VacationAdminForm({
  form,
  suppliers,
  disabled,
  onChange,
}: {
  form: VacationAdminFormState;
  suppliers: { id: string; name: string }[];
  disabled?: boolean;
  onChange: (next: VacationAdminFormState) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Dostawca" className="sm:col-span-2">
        <Select
          value={form.supplier_id}
          disabled={disabled || !!form.id}
          onChange={(e) => onChange({ ...form, supplier_id: e.target.value })}
        >
          <option value="">Wybierz dostawcę…</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Urlop od">
        <Input
          type="date"
          disabled={disabled}
          value={form.start_date}
          onChange={(e) => onChange({ ...form, start_date: e.target.value })}
        />
      </Field>
      <Field label="Urlop do">
        <Input
          type="date"
          disabled={disabled}
          value={form.end_date}
          onChange={(e) => onChange({ ...form, end_date: e.target.value })}
        />
      </Field>
      <Field label="Ostatnie zamówienie przed urlopem" className="sm:col-span-2">
        <Input
          type="date"
          disabled={disabled}
          value={form.last_order_date}
          onChange={(e) => onChange({ ...form, last_order_date: e.target.value })}
        />
      </Field>
      <label className="flex flex-col gap-1 sm:col-span-2">
        <span className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            disabled={disabled}
            checked={form.active}
            onChange={(e) => onChange({ ...form, active: e.target.checked })}
          />
          Urlop aktywny (uwzględniany w terminach i przy „Zamówione”)
        </span>
        <span className="text-xs text-slate-500">
          Aktywne okresy jednego dostawcy nie mogą się nakładać (włącznie z granicą dat).
        </span>
      </label>
    </div>
  );
}
