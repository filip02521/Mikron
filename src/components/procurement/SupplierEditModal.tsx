"use client";

import { useState } from "react";
import type { SupplierLocation, StatsMode } from "@/types/database";
import type { SupplierSummaryMeta } from "@/lib/orders/summary-workspace";
import { actionUpsertSupplier } from "@/app/actions/admin";
import { useActionPending } from "@/hooks/useActionPending";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  defaultOrderOnDemandChecked,
  suggestOrderOnDemandAfterFieldChange,
} from "@/lib/orders/supplier-on-demand";
import { SupplierSubiektLinkField } from "@/components/admin/SupplierSubiektLinkField";

const LOCATIONS: { value: SupplierLocation; label: string }[] = [
  { value: "POLSKA", label: "Polska" },
  { value: "ZAGRANICA", label: "Zagranica" },
  { value: "IMPORT", label: "Import" },
];

function formFromSupplier(s: SupplierSummaryMeta | null) {
  if (!s) {
    return {
      id: undefined as string | undefined,
      name: "",
      location: "POLSKA" as SupplierLocation,
      pickup_mikran: false,
      pickup_pallet: false,
      notes: "",
      mails: "",
      extra_info: "",
      interval_raw: "2 MIESIĄCE",
      stock_raw: "2 MIESIĄCE",
      stats_mode: "LACZNIE" as StatsMode,
      order_on_demand: false,
      subiekt_kh_id: null as number | null,
    };
  }
  return {
    id: s.id,
    name: s.name,
    location: s.location,
    pickup_mikran: s.pickup_mikran,
    pickup_pallet: s.pickup_pallet,
    notes: s.notes,
    mails: s.mails,
    extra_info: s.extra_info,
    interval_raw: s.interval_raw ?? "",
    stock_raw: s.stock_raw ?? (s.stock != null ? String(s.stock) : ""),
    stats_mode: (s.stats_mode ?? "LACZNIE") as StatsMode,
    order_on_demand: defaultOrderOnDemandChecked({
      order_on_demand: s.order_on_demand,
      stock_raw: s.stock_raw,
      interval_raw: s.interval_raw,
      extra_info: s.extra_info,
    }),
    subiekt_kh_id: s.subiekt_kh_id ?? null,
  };
}

export function SupplierEditModal({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: SupplierSummaryMeta | null;
  onClose: () => void;
  onSaved?: (id: string, message: string) => void;
}) {
  const isNew = !supplier;
  const { pending, pendingMessage, run } = useActionPending();
  const [form, setForm] = useState(() => formFromSupplier(supplier));

  const patchCycleFields = (
    patch: Partial<Pick<typeof form, "stock_raw" | "interval_raw" | "extra_info">>
  ) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      return {
        ...next,
        order_on_demand: suggestOrderOnDemandAfterFieldChange(prev.order_on_demand, {
          stock_raw: next.stock_raw,
          interval_raw: next.interval_raw,
          extra_info: next.extra_info,
        }),
      };
    });
  };

  const save = () => {
    if (!form.name.trim()) return;
    run(
      async () => {
        const result = await actionUpsertSupplier(form);
        onSaved?.(
          result.id,
          isNew ? `Dodano dostawcę „${form.name.trim()}”.` : "Zapisano zmiany dostawcy."
        );
        onClose();
      },
      isNew ? "Dodawanie dostawcy…" : "Zapisywanie karty dostawcy…"
    );
  };

  return (
    <ModalShell
      open
      onClose={onClose}
      title={isNew ? "Nowy dostawca" : `Edycja — ${supplier?.name ?? ""}`}
      size="lg"
      tier="raised"
      loadingMessage={pendingMessage}
      disableBackdropClose={pending}
      bodyClassName="px-5 py-4 sm:px-6"
      description={
        isNew
          ? undefined
          : "Przewijaj pola w oknie — nagłówek i przyciski Zapisz / Anuluj pozostają na miejscu."
      }
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>
            Anuluj
          </Button>
          <Button disabled={pending} onClick={save}>
            Zapisz
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {!isNew && form.id ? (
          <div className="sm:col-span-2">
            <SupplierSubiektLinkField
              supplierId={form.id}
              supplierName={form.name}
              subiektKhId={form.subiekt_kh_id}
              onLinked={(khId) => setForm((f) => ({ ...f, subiekt_kh_id: khId }))}
            />
          </div>
        ) : null}
        <Field label="Nazwa" className="sm:col-span-2">
          <Input
            disabled={pending}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Lokalizacja">
          <Select
            disabled={pending}
            value={form.location}
            onChange={(e) =>
              setForm({ ...form, location: e.target.value as SupplierLocation })
            }
          >
            {LOCATIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Częstotliwość">
          <Input
            disabled={pending}
            value={form.interval_raw}
            onChange={(e) => patchCycleFields({ interval_raw: e.target.value })}
          />
        </Field>
        <Field label="Sposób zamówienia" className="sm:col-span-2">
          <Select
            disabled={pending}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          >
            <option value="">—</option>
            <option value="MAILOWO">Mail</option>
            <option value="TELEFONICZNIE">Telefon</option>
            <option value="PRZEZ INTERNET">Internet</option>
          </Select>
        </Field>
        <Field label="E-mail i strony" className="sm:col-span-2">
          <Input
            disabled={pending}
            value={form.mails}
            onChange={(e) => setForm({ ...form, mails: e.target.value })}
          />
        </Field>
        <Field label="Zapas (okres)" className="sm:col-span-2">
          <Input
            disabled={pending}
            value={form.stock_raw}
            onChange={(e) => patchCycleFields({ stock_raw: e.target.value })}
            placeholder="np. 2 MIESIĄCE lub W RAZIE POTRZEBY"
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-2 sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300"
            checked={form.order_on_demand}
            disabled={pending}
            onChange={(e) =>
              setForm({ ...form, order_on_demand: e.target.checked })
            }
          />
          <span className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">Tylko w razie potrzeby</span>
            <span className="mt-0.5 block text-slate-500">
              Bez stałego terminu w planie tygodnia — lista w panelu dziennym.
            </span>
          </span>
        </label>
      </div>
    </ModalShell>
  );
}
