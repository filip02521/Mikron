"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useLatest } from "@/hooks/useLatest";
import type { SupplierLocation, SupplierWithSchedule } from "@/types/database";
import {
  actionUpsertSupplier,
  actionDeleteSupplier,
  actionSetSupplierActive,
} from "@/app/actions/admin";
import { isSupplierActive, inactiveSupplierRowClass } from "@/lib/suppliers/active";
import { formatStockPeriod, locationLabel } from "@/lib/display-labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { OrderMethodBadge } from "@/components/targets/OrderMethodBadge";
import { SupplierLocationFilters } from "@/components/admin/SupplierLocationFilters";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  countSuppliersByLocation,
  filterSuppliersForAdmin,
  type SupplierLocationFilter,
} from "@/lib/supplier-locations";
import {
  isSupplierOrderOnDemand,
  suggestOrderOnDemandAfterFieldChange,
} from "@/lib/orders/supplier-on-demand";
import {
  emptySupplierAdminForm,
  supplierToAdminForm,
} from "@/lib/suppliers/admin-form";
import { Badge } from "@/components/ui/Badge";
import { SupplierSubiektLinkIndicator } from "@/components/admin/SupplierSubiektLinkIndicator";
import {
  SupplierAdminForm,
  type SupplierAdminFormState,
} from "@/components/admin/SupplierAdminForm";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import { cn } from "@/lib/cn";

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
  const [form, setForm] = useState<SupplierAdminFormState>(emptySupplierAdminForm);
  const formRef = useLatest(form);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithSchedule | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierWithSchedule | null>(
    null
  );

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
    setForm(supplierToAdminForm(s));
    setFormOpen(true);
  };

  const openNew = () => {
    setForm(emptySupplierAdminForm());
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

  useEffect(() => {
    if (!formOpen || !form.id) return;
    const row = document.getElementById(`supplier-row-${form.id}`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [formOpen, form.id]);

  const resetForm = () => {
    setForm(emptySupplierAdminForm());
    setFormOpen(false);
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

  const confirmDeactivate = () => {
    const s = deactivateTarget;
    if (!s) return;
    start(async () => {
      try {
        await actionSetSupplierActive(s.id, false);
        setRows((list) => list.filter((x) => x.id !== s.id));
        if (form.id === s.id) resetForm();
        setDeactivateTarget(null);
        setToast({
          text: `„${s.name}” oznaczono jako nieaktywny — nie pojawi się w panelu dziennym.`,
          tone: "success",
        });
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      }
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
        if (snapshot.id && !snapshot.is_active) {
          setRows((list) => list.filter((x) => x.id !== snapshot.id));
        }
        setToast({
          text: snapshot.id
            ? snapshot.is_active
              ? "Zapisano zmiany dostawcy"
              : "Dostawca oznaczony jako nieaktywny"
            : "Dodano dostawcę",
          tone: "success",
        });
        resetForm();
        router.refresh();
      } catch (e) {
        setToast({ text: e instanceof Error ? e.message : "Błąd zapisu", tone: "error" });
      }
    });
  };

  const sheetTitle = form.id ? form.name || "Edytuj dostawcę" : "Nowy dostawca";
  const sheetDescription = form.id
    ? "Pola poniżej — zapis na dole panelu. Lista kart zostaje widoczna po lewej."
    : "Zapas = na jaki okres robisz większe zamówienie (np. 2 miesiące).";

  return (
    <>
      {toast ? <Toast message={toast.text} tone={toast.tone} onDismiss={dismiss} /> : null}
      <ConfirmDialog
        open={!!deactivateTarget}
        title="Oznaczyć jako nieaktywnego?"
        message={
          deactivateTarget
            ? `„${deactivateTarget.name}” zniknie z panelu dziennego i planu tygodnia. Harmonogram i karta pozostaną — przywrócisz w zakładce Nieaktywni.`
            : ""
        }
        confirmLabel="Dezaktywuj"
        danger
        pending={pending}
        onCancel={() => setDeactivateTarget(null)}
        onConfirm={confirmDeactivate}
      />
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

      <SupplierEditSheet
        open={formOpen}
        title={sheetTitle}
        description={sheetDescription}
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            <Button type="submit" form="supplier-admin-form" disabled={pending}>
              {form.id ? "Zapisz zmiany" : "Dodaj dostawcę"}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={resetForm}>
              Anuluj
            </Button>
          </>
        }
      >
        <form
          id="supplier-admin-form"
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
            onSubiektLinked={(khId) => {
              setForm((f) => ({ ...f, subiekt_kh_id: khId }));
              if (form.id) {
                setRows((list) =>
                  list.map((r) => (r.id === form.id ? { ...r, subiekt_kh_id: khId } : r))
                );
              }
            }}
          />
        </form>
      </SupplierEditSheet>

      <section className="space-y-6 p-4 sm:p-5">
        <Button variant="outline" onClick={openNew}>
          + Dodaj dostawcę
        </Button>

        <Card padding={false}>
          <CardHeader
            inset
            title={`Karty (${filtered.length}${locationFilter !== "all" || search.trim() ? ` z ${rows.length}` : ""})`}
            description="Edycja otwiera panel z boku — bez przewijania do góry strony."
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
                brak powiązania — ustaw w panelu edycji
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
                  {filtered.map((s) => {
                    const isEditing = formOpen && form.id === s.id;
                    return (
                      <tr
                        key={s.id}
                        id={`supplier-row-${s.id}`}
                        className={cn(
                          inactiveSupplierRowClass(isSupplierActive(s)),
                          isEditing && "bg-indigo-50/80 ring-1 ring-inset ring-indigo-200"
                        )}
                      >
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
                            {isEditing ? (
                              <Badge variant="info" className="text-[10px]">
                                Edycja
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-800"
                              onClick={() => setDeactivateTarget(s)}
                            >
                              Dezaktywuj
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
                    );
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          )}
        </Card>
      </section>
    </>
  );
}
