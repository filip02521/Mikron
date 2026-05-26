"use client";

import type { SupplierLocation, StatsMode } from "@/types/database";
import { Field, Input, Select } from "@/components/ui/Field";
import { SUPPLIER_LOCATION_OPTIONS } from "@/lib/supplier-locations";
import { SupplierSubiektLinkField } from "@/components/admin/SupplierSubiektLinkField";

export type SupplierAdminFormState = {
  id?: string;
  name: string;
  location: SupplierLocation;
  pickup_mikran: boolean;
  pickup_pallet: boolean;
  notes: string;
  mails: string;
  extra_info: string;
  interval_raw: string;
  stock_raw: string;
  stats_mode: StatsMode;
  order_on_demand: boolean;
  subiekt_kh_id: number | null;
};

export function SupplierAdminForm({
  form,
  disabled,
  onChange,
  onPatchCycleFields,
  onSubiektLinked,
}: {
  form: SupplierAdminFormState;
  disabled?: boolean;
  onChange: (next: SupplierAdminFormState) => void;
  onPatchCycleFields: (
    patch: Partial<Pick<SupplierAdminFormState, "stock_raw" | "interval_raw" | "extra_info">>
  ) => void;
  onSubiektLinked?: (khId: number | null) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {form.id ? (
        <div className="sm:col-span-2">
          <SupplierSubiektLinkField
            supplierId={form.id}
            supplierName={form.name}
            subiektKhId={form.subiekt_kh_id}
            onLinked={(khId) => onSubiektLinked?.(khId)}
          />
        </div>
      ) : null}
      <Field label="Nazwa dostawcy">
        <Input
          disabled={disabled}
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
        />
      </Field>
      <Field label="Lokalizacja">
        <Select
          disabled={disabled}
          value={form.location}
          onChange={(e) =>
            onChange({ ...form, location: e.target.value as SupplierLocation })
          }
        >
          {SUPPLIER_LOCATION_OPTIONS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
        Kontakt i sposób zamówienia
      </p>
      <Field label="Sposób zamówienia" className="sm:col-span-2">
        <Select
          disabled={disabled}
          value={form.notes}
          onChange={(e) => onChange({ ...form, notes: e.target.value })}
        >
          <option value="">—</option>
          <option value="MAILOWO">Mail</option>
          <option value="TELEFONICZNIE">Telefon</option>
          <option value="PRZEZ INTERNET">Internet</option>
        </Select>
      </Field>
      <Field label="E-mail i strony" className="sm:col-span-2">
        <Input
          disabled={disabled}
          value={form.mails}
          onChange={(e) => onChange({ ...form, mails: e.target.value })}
        />
      </Field>
      <Field label="Dodatkowe informacje" className="sm:col-span-2">
        <Input
          disabled={disabled}
          value={form.extra_info}
          onChange={(e) => onPatchCycleFields({ extra_info: e.target.value })}
        />
      </Field>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
        Cykl zamówień
        <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
          (wpływa na przeliczanie terminów)
        </span>
      </p>
      <Field label="Zapas (okres zamówienia)">
        <Input
          disabled={disabled}
          placeholder="np. 2 miesiące, 6 tyg., w razie potrzeby"
          value={form.stock_raw}
          onChange={(e) => onPatchCycleFields({ stock_raw: e.target.value })}
        />
      </Field>
      <Field label="Częstotliwość zamówień">
        <Input
          disabled={disabled}
          placeholder="np. 6 tyg. lub 1 miesiąc"
          value={form.interval_raw}
          onChange={(e) => onPatchCycleFields({ interval_raw: e.target.value })}
        />
      </Field>
      <Field label="Statystyki dostaw">
        <Select
          disabled={disabled}
          value={form.stats_mode}
          onChange={(e) =>
            onChange({ ...form, stats_mode: e.target.value as StatsMode })
          }
        >
          <option value="LACZNIE">Łącznie</option>
          <option value="OSOBNO">Osobno</option>
        </Select>
      </Field>
      <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={form.order_on_demand}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, order_on_demand: e.target.checked })}
        />
        <span className="text-sm text-slate-700">
          Tylko w razie potrzeby — bez stałego terminu w panelu dziennym
        </span>
      </label>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
        Odbiór
      </p>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          disabled={disabled}
          checked={form.pickup_mikran}
          onChange={(e) => onChange({ ...form, pickup_mikran: e.target.checked })}
        />
        Kierowca Mikran
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          disabled={disabled}
          checked={form.pickup_pallet}
          onChange={(e) => onChange({ ...form, pickup_pallet: e.target.checked })}
        />
        Zlecamy odbiór palety
      </label>
    </div>
  );
}
