"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import type { SupplierLocation, StatsMode, SupplierWithSchedule } from "@/types/database";
import { actionUpsertSupplier, actionDeleteSupplier } from "@/app/actions/admin";
import { formatStockPeriod, locationLabel } from "@/lib/display-labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { SupplierLocationFilters } from "@/components/admin/SupplierLocationFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  SUPPLIER_LOCATION_OPTIONS,
  countSuppliersByLocation,
  filterSuppliersForAdmin,
  type SupplierLocationFilter,
} from "@/lib/supplier-locations";
import {
  defaultOrderOnDemandChecked,
  isSupplierOrderOnDemand,
  suggestOrderOnDemandAfterFieldChange,
} from "@/lib/orders/supplier-on-demand";
import { Badge } from "@/components/ui/Badge";
import { SupplierSubiektLinkField } from "@/components/admin/SupplierSubiektLinkField";
import { SupplierSubiektLinkIndicator } from "@/components/admin/SupplierSubiektLinkIndicator";

type FormState = {
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

const emptyForm = (): FormState => ({
  name: "",
  location: "POLSKA",
  pickup_mikran: false,
  pickup_pallet: false,
  notes: "",
  mails: "",
  extra_info: "",
  interval_raw: "2 MIESIĄCE",
  stock_raw: "2 MIESIĄCE",
  stats_mode: "LACZNIE",
  order_on_demand: false,
  subiekt_kh_id: null,
});

function scheduleHref(location: SupplierLocation, name: string): string {
  const q = encodeURIComponent(name);
  return `/lokalizacje/${location}?q=${q}`;
}

export function SuppliersAdminClient({
  initial,
  allowDelete = true,
}: {
  initial: SupplierWithSchedule[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<SupplierLocationFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithSchedule | null>(null);

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (q) setSearch(q);
  }, [searchParams]);

  const locationCounts = useMemo(() => countSuppliersByLocation(rows), [rows]);

  const filtered = useMemo(
    () => filterSuppliersForAdmin(rows, locationFilter, search),
    [rows, locationFilter, search]
  );

  const startEdit = (s: SupplierWithSchedule) => {
    setForm({
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
      stats_mode: s.stats_mode,
      order_on_demand: defaultOrderOnDemandChecked(s),
      subiekt_kh_id: s.subiekt_kh_id ?? null,
    });
    setFormOpen(true);
  };

  useEffect(() => {
    const q = searchParams.get("q")?.trim();
    if (searchParams.get("powiaz") !== "1" || !q || formOpen) return;
    const match =
      rows.find((r) => r.name.toLowerCase() === q.toLowerCase()) ??
      rows.find((r) => r.name.toLowerCase().includes(q.toLowerCase()));
    if (match) startEdit(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tylko wejście z linku ?powiaz=1
  }, [searchParams, rows, formOpen]);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const patchCycleFields = (
    patch: Partial<Pick<FormState, "stock_raw" | "interval_raw" | "extra_info">>
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
    if (!form.name.trim()) {
      setToast({ text: "Podaj nazwę dostawcy", tone: "error" });
      return;
    }
    start(async () => {
      try {
        await actionUpsertSupplier(form);
        setToast({
          text: form.id ? "Zapisano zmiany dostawcy" : "Dodano dostawcę",
          tone: "success",
        });
        resetForm();
        router.refresh();
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd zapisu", tone: "error" });
      }
    });
  };

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}
      {allowDelete ? (
      <ConfirmDialog
        open={!!deleteTarget}
        title="Usunąć dostawcę?"
        message={
          deleteTarget
            ? `Czy na pewno usunąć „${deleteTarget.name}”? Tej operacji nie można cofnąć.`
            : ""
        }
        confirmLabel="Usuń"
        danger
        pending={pending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          start(async () => {
            const r = await actionDeleteSupplier(deleteTarget.id);
            if ("error" in r) {
              setToast({ text: r.error, tone: "error" });
              setDeleteTarget(null);
              return;
            }
            setRows((list) => list.filter((x) => x.id !== deleteTarget.id));
            setDeleteTarget(null);
            setToast({ text: "Dostawca usunięty", tone: "success" });
          });
        }}
      />
      ) : null}

      <section className="space-y-6 p-4 sm:p-5">
        {!formOpen ? (
          <Button
            variant="outline"
            onClick={() => {
              setForm(emptyForm());
              setFormOpen(true);
            }}
          >
            + Dodaj dostawcę
          </Button>
        ) : null}

        {formOpen ? (
          <Card>
            <CardHeader
              title={form.id ? "Edytuj dostawcę" : "Dodaj dostawcę"}
              description={
                form.id
                  ? "Na górze formularza możesz powiązać kartę z kontrahentem Subiekt (auto-dostawca z ZD)."
                  : "Zapas = na jaki okres robisz większe zamówienie (np. 2 miesiące)."
              }
            />
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              {form.id ? (
                <div className="sm:col-span-2">
                  <SupplierSubiektLinkField
                    supplierId={form.id}
                    supplierName={form.name}
                    subiektKhId={form.subiekt_kh_id}
                    onLinked={(khId) => {
                      setForm((f) => ({ ...f, subiekt_kh_id: khId }));
                      setRows((list) =>
                        list.map((r) =>
                          r.id === form.id ? { ...r, subiekt_kh_id: khId } : r
                        )
                      );
                    }}
                  />
                </div>
              ) : null}
              <Field label="Nazwa dostawcy">
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Lokalizacja">
                <Select
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value as SupplierLocation })
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
                  value={form.mails}
                  onChange={(e) => setForm({ ...form, mails: e.target.value })}
                />
              </Field>
              <Field label="Dodatkowe informacje" className="sm:col-span-2">
                <Input
                  value={form.extra_info}
                  onChange={(e) => patchCycleFields({ extra_info: e.target.value })}
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
                  placeholder="np. 2 miesiące, 6 tyg., w razie potrzeby"
                  value={form.stock_raw}
                  onChange={(e) => patchCycleFields({ stock_raw: e.target.value })}
                />
              </Field>
              <Field label="Częstotliwość zamówień">
                <Input
                  placeholder="np. 6 tyg. lub 1 miesiąc"
                  value={form.interval_raw}
                  onChange={(e) => patchCycleFields({ interval_raw: e.target.value })}
                />
              </Field>
              <Field label="Statystyki dostaw">
                <Select
                  value={form.stats_mode}
                  onChange={(e) =>
                    setForm({ ...form, stats_mode: e.target.value as StatsMode })
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
                  onChange={(e) =>
                    setForm({ ...form, order_on_demand: e.target.checked })
                  }
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
                  checked={form.pickup_mikran}
                  onChange={(e) =>
                    setForm({ ...form, pickup_mikran: e.target.checked })
                  }
                />
                Kierowca Mikran
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.pickup_pallet}
                  onChange={(e) =>
                    setForm({ ...form, pickup_pallet: e.target.checked })
                  }
                />
                Zlecamy odbiór palety
              </label>
              <p className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" disabled={pending}>
                  {form.id ? "Zapisz zmiany" : "Dodaj dostawcę"}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Anuluj
                </Button>
              </p>
            </form>
          </Card>
        ) : null}

        <Card padding={false}>
          <CardHeader
            inset
            title={`Karty (${filtered.length}${locationFilter !== "all" || search.trim() ? ` z ${rows.length}` : ""})`}
            description="Kolumna Subiekt: ikona powiązania. Edytuj lub „Powiąż” — sekcja na górze formularza."
          />
          <div className="space-y-3 border-b border-slate-100 px-6 pb-4">
            <p className="text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <SupplierSubiektLinkIndicator subiektKhId={1} className="scale-90" />
                powiązany z Subiektem
              </span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="inline-flex items-center gap-1.5">
                <SupplierSubiektLinkIndicator subiektKhId={null} className="scale-90" />
                brak powiązania — ustaw ręcznie
              </span>
            </p>
            <SupplierLocationFilters
              value={locationFilter}
              onChange={setLocationFilter}
              counts={locationCounts}
              className="w-full max-w-full flex-wrap"
            />
            <Input
              type="search"
              placeholder="Szukaj dostawcy…"
              className="max-w-sm py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              title="Brak dostawców w tym widoku"
              description={
                search.trim()
                  ? "Zmień wyszukiwanie lub wybierz inną lokalizację."
                  : "Wybierz inną lokalizację albo dodaj nowego dostawcę."
              }
            />
          ) : (
          <TableScroll>
            <DataTable>
              <thead>
                <tr>
                  <th className="w-14 text-center">Subiekt</th>
                  <th>Nazwa</th>
                  <th>Lokalizacja</th>
                  <th>Sposób</th>
                  <th>Zapas</th>
                  <th>Częstotliwość</th>
                  <th>Terminy</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td className="w-14 text-center">
                      <SupplierSubiektLinkIndicator subiektKhId={s.subiekt_kh_id} />
                    </td>
                    <td>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{s.name}</span>
                        {isSupplierOrderOnDemand(s) ? (
                          <Badge variant="purple" className="text-[10px]">
                            Na żądanie
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td>{locationLabel(s.location)}</td>
                    <td>
                      <OrderMethodBadge notes={s.notes} />
                    </td>
                    <td className="max-w-[140px] text-sm text-slate-700">
                      {formatStockPeriod(s.stock_raw, s.stock != null ? Number(s.stock) : null)}
                    </td>
                    <td className="text-sm text-slate-700">
                      {s.interval_raw?.trim() || s.interval_weeks || "—"}
                    </td>
                    <td>
                      <Link
                        href={scheduleHref(s.location, s.name)}
                        className="text-sm font-medium text-sky-700 hover:text-sky-900 hover:underline"
                      >
                        Terminy →
                      </Link>
                    </td>
                    <td>
                      <p className="flex justify-end gap-1">
                        {s.subiekt_kh_id == null ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => startEdit(s)}
                          >
                            Powiąż
                          </Button>
                        ) : null}
                        <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                          Edytuj
                        </Button>
                        {allowDelete ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setDeleteTarget(s)}
                          >
                            Usuń
                          </Button>
                        ) : null}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </TableScroll>
          )}
        </Card>
      </section>
    </>
  );
}
