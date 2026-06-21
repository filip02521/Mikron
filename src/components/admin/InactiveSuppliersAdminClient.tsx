"use client";

import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useLatest } from "@/hooks/useLatest";
import type { SupplierLocation, SupplierWithSchedule } from "@/types/database";
import { actionSetSupplierActive, actionUpsertSupplier } from "@/app/actions/admin";
import { formatPlDate } from "@/lib/display-labels";
import { formatSupplierCycleSummary, formatSupplierListMeta } from "@/lib/suppliers/supplier-list-labels";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { SupplierAdminCardsFilterBar } from "@/components/admin/SupplierHubListFilters";
import { SupplierAdminNameCell } from "@/components/admin/SupplierAdminNameCell";
import { InactiveSupplierRowMenu } from "@/components/admin/InactiveSupplierRowMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  countSuppliersByLocation,
  countSuppliersBySubiektLink,
  filterSuppliersForAdmin,
  type SupplierLocationFilter,
  type SupplierSubiektFilter,
} from "@/lib/supplier-locations";
import { InactiveSupplierBadge } from "@/components/suppliers/InactiveSupplierBadge";
import { supplierHubPaths, SUPPLIER_HUB_LIST_META_DESCRIPTION, type SupplierHubContext } from "@/lib/supplier-hub";
import {
  SupplierAdminForm,
  type SupplierAdminFormState,
} from "@/components/admin/SupplierAdminForm";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import {
  applyAdminFormToSupplierRow,
  emptySupplierAdminForm,
  supplierToAdminForm,
} from "@/lib/suppliers/admin-form";
import { suggestOrderOnDemandAfterFieldChange } from "@/lib/orders/supplier-on-demand";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { cn } from "@/lib/cn";

function scheduleHref(location: SupplierLocation, name: string): string {
  return `/lokalizacje/${location}?q=${encodeURIComponent(name)}`;
}

function parseLocationFilter(raw: string | null): SupplierLocationFilter {
  if (raw === "POLSKA" || raw === "ZAGRANICA" || raw === "IMPORT") return raw;
  return "all";
}

function parseSubiektFilter(raw: string | null): SupplierSubiektFilter {
  if (raw === "unlinked" || raw === "linked") return raw;
  return "all";
}

function inactiveRowClass(isEditing: boolean): string {
  return cn("bg-slate-50/80", isEditing && "bg-indigo-50/80 ring-1 ring-inset ring-indigo-200");
}

export function InactiveSuppliersAdminClient({
  initial,
  context,
  warehouseCarriers = [],
}: {
  initial: SupplierWithSchedule[];
  context: SupplierHubContext;
  warehouseCarriers?: WarehouseCarrierRow[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const cardsPath = supplierHubPaths(context).cards;
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast({ text, tone: "error" })
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<SupplierLocationFilter>("all");
  const [subiektFilter, setSubiektFilter] = useState<SupplierSubiektFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SupplierAdminFormState>(emptySupplierAdminForm);
  const formRef = useLatest(form);

  const initialKey = initial.map((row) => `${row.id}\0${row.name}\0${row.subiekt_kh_id ?? ""}`).join("\n");
  const [appliedInitialKey, setAppliedInitialKey] = useState(initialKey);
  if (initialKey !== appliedInitialKey) {
    setAppliedInitialKey(initialKey);
    setRows(initial);
  }

  const urlFiltersKey = searchParams.toString();
  const [appliedUrlFiltersKey, setAppliedUrlFiltersKey] = useState(urlFiltersKey);
  if (urlFiltersKey !== appliedUrlFiltersKey) {
    setAppliedUrlFiltersKey(urlFiltersKey);
    setSearch(searchParams.get("q")?.trim() ?? "");
    setLocationFilter(parseLocationFilter(searchParams.get("location")));
    setSubiektFilter(parseSubiektFilter(searchParams.get("subiekt")));
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const q = search.trim();
      if (q) params.set("q", q);
      else params.delete("q");
      if (locationFilter !== "all") params.set("location", locationFilter);
      else params.delete("location");
      if (subiektFilter !== "all") params.set("subiekt", subiektFilter);
      else params.delete("subiekt");
      const next = params.toString();
      if (next !== searchParams.toString()) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, locationFilter, subiektFilter, pathname, router, searchParams]);

  const locationScopedRows = useMemo(() => {
    if (locationFilter === "all") return rows;
    return rows.filter((s) => s.location === locationFilter);
  }, [rows, locationFilter]);

  const locationCounts = useMemo(() => countSuppliersByLocation(rows), [rows]);
  const subiektCounts = useMemo(
    () => countSuppliersBySubiektLink(locationScopedRows),
    [locationScopedRows]
  );
  const filtered = useMemo(
    () =>
      filterSuppliersForAdmin(
        rows,
        locationFilter,
        search,
        subiektFilter,
        subiektFilter === "all"
      ),
    [rows, locationFilter, search, subiektFilter]
  );

  const filterActive =
    locationFilter !== "all" || subiektFilter !== "all" || search.trim().length > 0;

  const resetForm = () => {
    setForm(emptySupplierAdminForm());
    setFormOpen(false);
  };

  const startEdit = (s: SupplierWithSchedule) => {
    if (blockIfReadOnly()) return;
    setForm(supplierToAdminForm(s));
    setFormOpen(true);
  };

  useEffect(() => {
    if (!formOpen || !form.id) return;
    const row = document.getElementById(`inactive-supplier-row-${form.id}`);
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [formOpen, form.id]);

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
    if (blockIfReadOnly()) return;
    if (!form.name.trim()) {
      setToast({ text: "Podaj nazwę dostawcy", tone: "error" });
      return;
    }
    start(async () => {
      const snapshot = { ...formRef.current };
      try {
        await actionUpsertSupplier(snapshot);
        if (snapshot.id) {
          if (snapshot.is_active) {
            setRows((list) => list.filter((x) => x.id !== snapshot.id));
            setToast({
              text: `„${snapshot.name}” przywrócony — pojawi się w panelu dziennym.`,
              tone: "success",
            });
          } else {
            setRows((list) =>
              list.map((r) =>
                r.id === snapshot.id ? applyAdminFormToSupplierRow(r, snapshot) : r
              )
            );
            setToast({ text: "Zapisano kartę dostawcy", tone: "success" });
          }
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
    if (blockIfReadOnly()) return;
    start(async () => {
      try {
        await actionSetSupplierActive(s.id, true);
        setRows((list) => list.filter((x) => x.id !== s.id));
        if (form.id === s.id) resetForm();
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
        description="Możesz przywrócić aktywność checkboxem w formularzu lub z menu ⋮ na liście."
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            <Button type="submit" form="inactive-supplier-form" disabled={readOnly || pending}>
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
            disabled={readOnly || pending}
            onChange={setForm}
            onPatchCycleFields={patchCycleFields}
            carrierOptions={warehouseCarriers}
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

      <section className="space-y-4">
        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={`Nieaktywni (${filtered.length}${filterActive ? ` z ${rows.length}` : ""})`}
            description={SUPPLIER_HUB_LIST_META_DESCRIPTION}
          />

          <SupplierAdminCardsFilterBar
            locationFilter={locationFilter}
            onLocationFilterChange={setLocationFilter}
            locationCounts={locationCounts}
            subiektFilter={subiektFilter}
            onSubiektFilterChange={setSubiektFilter}
            subiektCounts={subiektCounts}
            search={search}
            onSearchChange={setSearch}
            searchId="inactive-supplier-search"
            searchAriaLabel="Szukaj nieaktywnego dostawcy po nazwie"
          />

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
            <>
              <div
                className="hidden border-b border-slate-100 bg-slate-50/90 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(100px,120px)_minmax(88px,100px)_minmax(120px,160px)] md:gap-3 lg:px-5"
                aria-hidden
              >
                <span>Dostawca</span>
                <span>Cykl</span>
                <span>Następne</span>
                <span>Terminy</span>
                <span className="text-right">Akcje</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const isEditing = formOpen && form.id === s.id;
                  const cycleSummary = formatSupplierCycleSummary(s);
                  const cycleIncomplete = cycleSummary === "Uzupełnij cykl";
                  return (
                    <li
                      key={s.id}
                      id={`inactive-supplier-row-${s.id}`}
                      className={cn(
                        "px-3 py-3 sm:px-4 lg:px-5",
                        inactiveRowClass(isEditing),
                        s.subiekt_kh_id == null && "bg-amber-50/40"
                      )}
                    >
                      <div className="flex items-start gap-2 md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(100px,120px)_minmax(88px,100px)_minmax(120px,160px)] md:items-center md:gap-3">
                        <div className="min-w-0 flex-1 md:contents">
                          <div className="min-w-0 md:block">
                            <SupplierAdminNameCell
                              supplier={s}
                              isEditing={isEditing}
                              onEdit={() => startEdit(s)}
                              trailingBadge={<InactiveSupplierBadge className="text-[10px]" />}
                            />
                            <p className="mt-1 text-xs text-slate-500 md:mt-0.5">
                              {formatSupplierListMeta(s)}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "mt-2 text-sm md:mt-0",
                              cycleIncomplete
                                ? "font-medium text-amber-800"
                                : "text-slate-700"
                            )}
                          >
                            {cycleSummary}
                          </p>
                          <p className="mt-2 text-sm tabular-nums text-slate-600 md:mt-0">
                            {formatPlDate(s.schedule?.computed_next_date)}
                          </p>
                          <Link
                            href={scheduleHref(s.location, s.name)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline md:mt-0 md:text-sm"
                          >
                            Terminy
                            <LinkChevron size={12} tone="sky" className="md:hidden" />
                            <LinkChevron size={14} tone="sky" className="hidden md:inline" />
                          </Link>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 md:justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="hidden md:inline-flex"
                            disabled={readOnly || pending}
                            onClick={() => startEdit(s)}
                          >
                            Edytuj
                          </Button>
                          <InactiveSupplierRowMenu
                            supplier={s}
                            disabled={readOnly || pending}
                            onEdit={() => startEdit(s)}
                            onReactivate={() => reactivate(s)}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </Card>
      </section>
    </>
  );
}
