"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, useCallback } from "react";
import { useLatest } from "@/hooks/useLatest";
import type { SupplierWithSchedule } from "@/types/database";
import { actionSetSupplierActive, actionUpsertSupplier } from "@/app/actions/admin";
import { formatStockPeriod, locationLabel } from "@/lib/display-labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { SupplierLocationFilters } from "@/components/admin/SupplierLocationFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  countSuppliersByLocation,
  filterSuppliersForAdmin,
  type SupplierLocationFilter,
} from "@/lib/supplier-locations";
import { InactiveSupplierBadge } from "@/components/suppliers/InactiveSupplierBadge";
import { supplierHubPaths, type SupplierHubContext } from "@/lib/supplier-hub";
import type { SupplierLocation } from "@/types/database";
import {
  SupplierAdminForm,
  type SupplierAdminFormState,
} from "@/components/admin/SupplierAdminForm";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import {
  emptySupplierAdminForm,
  supplierToAdminForm,
} from "@/lib/suppliers/admin-form";
import { suggestOrderOnDemandAfterFieldChange } from "@/lib/orders/supplier-on-demand";

function scheduleHref(location: SupplierLocation, name: string): string {
  return `/lokalizacje/${location}?q=${encodeURIComponent(name)}`;
}

export function InactiveSuppliersAdminClient({
  initial,
  context,
}: {
  initial: SupplierWithSchedule[];
  context: SupplierHubContext;
}) {
  const router = useRouter();
  const cardsPath = supplierHubPaths(context).cards;
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<SupplierLocationFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SupplierAdminFormState>(emptySupplierAdminForm);
  const formRef = useLatest(form);

  const locationCounts = useMemo(() => countSuppliersByLocation(rows), [rows]);
  const filtered = useMemo(
    () => filterSuppliersForAdmin(rows, locationFilter, search),
    [rows, locationFilter, search]
  );

  const resetForm = () => {
    setForm(emptySupplierAdminForm());
    setFormOpen(false);
  };

  const startEdit = (s: SupplierWithSchedule) => {
    setForm(supplierToAdminForm(s));
    setFormOpen(true);
  };

  const patchCycleFields = (
    patch: Partial<Pick<SupplierAdminFormState, "stock_raw" | "interval_raw" | "extra_info">>
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
      const snapshot = { ...formRef.current };
      try {
        await actionUpsertSupplier(snapshot);
        if (snapshot.is_active) {
          setRows((list) => list.filter((x) => x.id !== snapshot.id));
          setToast({
            text: `„${snapshot.name}” przywrócony — pojawi się w panelu dziennym.`,
            tone: "success",
          });
        } else {
          setToast({ text: "Zapisano kartę dostawcy", tone: "success" });
        }
        resetForm();
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      }
    });
  };

  const reactivate = (s: SupplierWithSchedule) => {
    start(async () => {
      try {
        await actionSetSupplierActive(s.id, true);
        setRows((list) => list.filter((x) => x.id !== s.id));
        setToast({
          text: `„${s.name}” jest znowu aktywny — pojawi się w panelu dziennym.`,
          tone: "success",
        });
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się przywrócić",
          tone: "error",
        });
      }
    });
  };

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}

      <SupplierEditSheet
        open={formOpen}
        title={form.name || "Edytuj dostawcę"}
        description="Możesz przywrócić aktywność checkboxem lub przyciskiem na liście."
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            <Button type="submit" form="inactive-supplier-form" disabled={pending}>
              Zapisz
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={resetForm}>
              Anuluj
            </Button>
          </>
        }
      >
        <form
          id="inactive-supplier-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <SupplierAdminForm
            form={form}
            disabled={pending}
            onChange={setForm}
            onPatchCycleFields={patchCycleFields}
            onSubiektLinked={(khId) => setForm((f) => ({ ...f, subiekt_kh_id: khId }))}
          />
        </form>
      </SupplierEditSheet>

      <section className="space-y-6 p-4 sm:p-5">
        <p className="text-sm text-slate-600">
          Nieaktywni dostawcy nie są w cyklu{" "}
          <Link href="/podsumowanie" className="font-medium text-sky-700 hover:underline">
            panelu dziennego
          </Link>
          , ale nadal można do nich składać{" "}
          <Link href="/zamowienia/nowe" className="font-medium text-sky-700 hover:underline">
            prośby o produkty
          </Link>
          . Aktywnych zarządzasz w{" "}
          <Link href={cardsPath} className="font-medium text-sky-700 hover:underline">
            kartach dostawców
          </Link>
          .
        </p>

        <Card padding={false}>
          <CardHeader
            inset
            title={`Nieaktywni (${filtered.length}${locationFilter !== "all" || search.trim() ? ` z ${rows.length}` : ""})`}
            description="Edycja karty, terminy w harmonogramie lub przywrócenie aktywności."
          />
          <div className="space-y-3 border-b border-slate-100 px-6 pb-4">
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
              title="Brak nieaktywnych dostawców"
              description="Wszyscy dostawcy są aktywni. Dezaktywuj z listy Kart dostawców."
              action={
                <Link href={cardsPath}>
                  <Button variant="secondary" size="sm">
                    Karty dostawców
                  </Button>
                </Link>
              }
            />
          ) : (
            <TableScroll>
              <DataTable>
                <thead>
                  <tr>
                    <th>Nazwa</th>
                    <th>Lokalizacja</th>
                    <th>Sposób</th>
                    <th>Zapas / częstotliwość</th>
                    <th>Następne</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="bg-slate-50/80">
                      <td>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-600">{s.name}</span>
                          <InactiveSupplierBadge className="text-[10px]" />
                        </span>
                      </td>
                      <td>{locationLabel(s.location)}</td>
                      <td>
                        <OrderMethodBadge notes={s.notes} />
                      </td>
                      <td className="max-w-[160px] text-sm text-slate-600">
                        {formatStockPeriod(s.stock_raw, s.stock != null ? Number(s.stock) : null)}
                        <span className="text-slate-300"> · </span>
                        {s.interval_raw?.trim() || s.interval_weeks || "—"}
                      </td>
                      <td className="text-sm text-slate-600">
                        {s.schedule?.computed_next_date ?? "—"}
                      </td>
                      <td>
                        <p className="flex flex-wrap justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => startEdit(s)}>
                            Edytuj
                          </Button>
                          <Link href={scheduleHref(s.location, s.name)}>
                            <Button variant="ghost" size="sm">
                              Terminy
                            </Button>
                          </Link>
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={pending}
                            onClick={() => reactivate(s)}
                          >
                            Przywróć
                          </Button>
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
