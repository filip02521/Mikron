"use client";

import type { SupplierLocation, StatsMode } from "@/types/database";
import { Field, Input, Select } from "@/components/ui/Field";
import { SUPPLIER_LOCATION_OPTIONS } from "@/lib/supplier-locations";
import { SupplierSubiektLinkField } from "@/components/admin/SupplierSubiektLinkField";
import { SupplierCycleField } from "@/components/admin/SupplierCycleField";
import { SupplierFormSection } from "@/components/admin/SupplierFormSection";
import { FieldHintButton } from "@/components/admin/FieldHintButton";
import {
  SUPPLIER_INTERVAL_PRESETS,
  SUPPLIER_STOCK_PRESETS,
} from "@/lib/suppliers/cycle-presets";
import {
  WAREHOUSE_CARRIERS,
  WAREHOUSE_SHIPMENT_FORMS,
} from "@/lib/warehouse/delivery-carriers";

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
  is_active: boolean;
  subiekt_kh_id: number | null;
  default_delivery_carrier: string;
  default_delivery_shipment_form: string;
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

      <SupplierFormSection
        title="Kontakt i zamówienie"
        description="Sposób składania zamówienia i dane kontaktowe"
        defaultOpen
      >
        <Field label="Sposób zamówienia" className="sm:col-span-2">
          <Select
            disabled={disabled}
            value={form.notes}
            onChange={(e) => onChange({ ...form, notes: e.target.value })}
          >
            <option value="">— wybierz —</option>
            <option value="MAILOWO">Mail</option>
            <option value="TELEFONICZNIE">Telefon</option>
            <option value="PRZEZ INTERNET">Internet / portal</option>
          </Select>
        </Field>
        <Field label="E-mail i strony www" className="sm:col-span-2">
          <Input
            disabled={disabled}
            placeholder="adres@firma.pl, https://…"
            value={form.mails}
            onChange={(e) => onChange({ ...form, mails: e.target.value })}
          />
        </Field>
        <Field
          label="Uwagi do kontaktu"
          className="sm:col-span-2"
          hint="Np. osoba kontaktowa, godziny, minimalna kwota zamówienia."
        >
          <Input
            disabled={disabled}
            value={form.extra_info}
            onChange={(e) => onPatchCycleFields({ extra_info: e.target.value })}
          />
        </Field>
      </SupplierFormSection>

      <div className="rounded-md border border-indigo-100 bg-indigo-50/40 p-3 sm:col-span-2">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900">
              Cykl zamówień
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-indigo-900/80">
              Te pola przeliczają terminy w harmonogramie. Daty w cyklu edytujesz osobno w
              zakładce Terminy.
            </p>
          </div>
          <FieldHintButton label="Pomoc: cykl zamówień" title="Jak ustawić cykl?">
            <ul className="list-disc space-y-2 pl-4 text-xs leading-relaxed">
              <li>
                <strong>Częstotliwość</strong> — jak często zamawiasz u dostawcy (np. co 6 tyg.).
                System na tej podstawie liczy kolejne terminy.
              </li>
              <li>
                <strong>Zapas</strong> — na jaki okres robisz jednorazowo większe zamówienie (np.
                2 miesiące). Opisuje skalę zamówienia, nie datę.
              </li>
              <li>
                Wybierz wartość z listy albo „Inne” i wpisz jak w arkuszu:{" "}
                <span className="font-mono">6</span>,{" "}
                <span className="font-mono">2 MIESIĄCE</span>,{" "}
                <span className="font-mono">W RAZIE POTRZEBY</span>.
              </li>
            </ul>
          </FieldHintButton>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <SupplierCycleField
            label="Częstotliwość"
            hintLabel="Co oznacza częstotliwość"
            hintTitle="Częstotliwość zamówień"
            hintContent={
              <p className="text-xs leading-relaxed">
                Określa, co ile czasu wracasz do tego dostawcy w cyklu. Po zapisie system
                przelicza następne daty w harmonogramie.
              </p>
            }
            value={form.interval_raw}
            onChange={(raw) => onPatchCycleFields({ interval_raw: raw })}
            presets={SUPPLIER_INTERVAL_PRESETS}
            customPlaceholder="np. 6, 6 tyg., 2 miesiące, kwartał"
            disabled={disabled}
          />
          <SupplierCycleField
            label="Zapas (okres zamówienia)"
            hintLabel="Co oznacza zapas"
            hintTitle="Zapas — okres zamówienia"
            hintContent={
              <p className="text-xs leading-relaxed">
                Na jaki horyzont czasu planujesz większe zamówienie (np. zapas na 2 miesiące).
                To nie jest data — tylko opis skali zamówienia w Twoim procesie.
              </p>
            }
            value={form.stock_raw}
            onChange={(raw) => onPatchCycleFields({ stock_raw: raw })}
            presets={SUPPLIER_STOCK_PRESETS}
            customPlaceholder="np. 2 MIESIĄCE, 6 tyg., W RAZIE POTRZEBY"
            disabled={disabled}
          />
          <Field
            label={
              <span className="inline-flex items-center gap-1">
                Statystyki dostaw
                <FieldHintButton label="Statystyki dostaw" title="Łącznie vs osobno">
                  <p className="text-xs leading-relaxed">
                    Łącznie — jedna statystyka dla wszystkich produktów u dostawcy. Osobno —
                    liczniki per produkt (rzadziej).
                  </p>
                </FieldHintButton>
              </span>
            }
          >
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
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-2">
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
      </div>

      <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={form.is_active}
          disabled={disabled}
          onChange={(e) => onChange({ ...form, is_active: e.target.checked })}
        />
        <span className="text-sm text-slate-700">
          <span className="font-medium text-slate-900">Aktywny dostawca</span>
          {" — "}
          widoczny w panelu dziennym. Odznacz, aby przenieść na listę Nieaktywni.
        </span>
      </label>

      <SupplierFormSection
        title="Magazyn — domyślny kurier"
        description="Opcjonalnie; puste = system uczy się z wpisów magazynu"
      >
        <Field label="Kurier">
          <Select
            disabled={disabled}
            value={form.default_delivery_carrier}
            onChange={(e) =>
              onChange({ ...form, default_delivery_carrier: e.target.value })
            }
          >
            <option value="">— z historii wpisów —</option>
            {WAREHOUSE_CARRIERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Forma przesyłki">
          <Select
            disabled={disabled}
            value={form.default_delivery_shipment_form}
            onChange={(e) =>
              onChange({ ...form, default_delivery_shipment_form: e.target.value })
            }
          >
            <option value="">— z historii —</option>
            {WAREHOUSE_SHIPMENT_FORMS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
      </SupplierFormSection>

      <SupplierFormSection title="Odbiór u dostawcy" description="Kierowca / paleta">
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            disabled={disabled}
            checked={form.pickup_mikran}
            onChange={(e) => onChange({ ...form, pickup_mikran: e.target.checked })}
          />
          Kierowca Mikran odbiera towar
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
      </SupplierFormSection>
    </div>
  );
}
