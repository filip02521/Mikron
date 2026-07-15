"use client";
import { toastFromError, toastSuccess, SUPPLIER_TOAST, type ToastNotice } from "@/lib/ui/notice-copy";

import Link from "next/link";
import { LinkChevron } from "@/components/ui/UiGlyphs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, useCallback } from "react";
import { useLatest } from "@/hooks/useLatest";
import type { SupplierLocation, SupplierWithSchedule, TeethSupplierSchedule } from "@/types/database";
import {
  actionUpsertSupplier,
  actionDeleteSupplier,
  actionSetSupplierActive,
} from "@/app/actions/admin";
import { actionAddSupplierToTeethLane, actionRemoveTeethSchedule } from "@/app/actions/teeth-orders";
import { isSupplierActive } from "@/lib/suppliers/active";
import { formatSupplierCycleSummary, formatSupplierListMeta } from "@/lib/suppliers/supplier-list-labels";
import { formatTeethCycleSummary } from "@/lib/teeth/teeth-cycle-summary";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AddButton } from "@/components/ui/AddButton";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Input } from "@/components/ui/Field";
import { SupplierAdminCardsFilterBar } from "@/components/admin/SupplierHubListFilters";
import { SupplierAdminRowMenu } from "@/components/admin/SupplierAdminRowMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  countSuppliersByLocation,
  countSuppliersBySubiektLink,
  filterSuppliersForAdmin,
  type SupplierLocationFilter,
  type SupplierSubiektFilter,
} from "@/lib/supplier-locations";
import { suggestOrderOnDemandAfterFieldChange } from "@/lib/orders/supplier-on-demand";
import {
  applyAdminFormToSupplierRow,
  emptySupplierAdminForm,
  supplierToAdminForm,
} from "@/lib/suppliers/admin-form";
import { SupplierAdminNameCell } from "@/components/admin/SupplierAdminNameCell";
import {
  SupplierAdminForm,
  type SupplierAdminFormState,
} from "@/components/admin/SupplierAdminForm";
import { SupplierEditSheet } from "@/components/admin/SupplierEditSheet";
import { SUPPLIER_HUB_LIST_META_DESCRIPTION } from "@/lib/supplier-hub";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { Badge } from "@/components/ui/Badge";
import { IconPencil, IconMapPin, IconSearch, IconPlusCircle } from "@/components/icons/StrokeIcons";
import { cn } from "@/lib/cn";

function scheduleHref(location: SupplierLocation, name: string): string {
  const q = encodeURIComponent(name);
  return `/lokalizacje/${location}?q=${q}`;
}

function parseLocationFilter(raw: string | null): SupplierLocationFilter {
  if (raw === "POLSKA" || raw === "ZAGRANICA" || raw === "IMPORT") return raw;
  return "all";
}

function parseSubiektFilter(raw: string | null): SupplierSubiektFilter {
  if (raw === "unlinked" || raw === "linked") return raw;
  return "all";
}


export function SuppliersAdminClient({
  initial,
  allSuppliers,
  allowDelete = true,
  warehouseCarriers = [],
  teethScheduleSupplierIds,
  teethScheduleMap,
}: {
  initial: SupplierWithSchedule[];
  /** Wszyscy dostawcy (nieprzefiltrowani) — do pickera w torze zębów */
  allSuppliers?: SupplierWithSchedule[];
  allowDelete?: boolean;
  warehouseCarriers?: WarehouseCarrierRow[];
  /** ID dostawców z aktywnym cyklem zębów — tor ?tor=zeby */
  teethScheduleSupplierIds?: string[];
  /** Mapa harmonogramów zębów (supplierId → TeethSupplierSchedule) */
  teethScheduleMap?: Record<string, TeethSupplierSchedule>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const teethLane = searchParams.get("tor") === "zeby";
  const [rows, setRows] = useState(initial);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<ToastNotice | null>(null);
  const { readOnly, blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    setToast(toastFromError(text))
  );
  const dismiss = useCallback(() => setToast(null), []);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState<SupplierLocationFilter>("all");
  const [subiektFilter, setSubiektFilter] = useState<SupplierSubiektFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<SupplierAdminFormState>(emptySupplierAdminForm);
  const formRef = useLatest(form);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithSchedule | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<SupplierWithSchedule | null>(
    null
  );
  const [powiazHandled, setPowiazHandled] = useState(false);
  const [teethPickerOpen, setTeethPickerOpen] = useState(false);
  const [teethPickerSearch, setTeethPickerSearch] = useState("");
  const [teethRemoveTarget, setTeethRemoveTarget] = useState<SupplierWithSchedule | null>(null);

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

  const searchParamsRef = useLatest(searchParams);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const sp = searchParamsRef.current;
      const params = new URLSearchParams(sp.toString());
      const q = search.trim();
      if (q) params.set("q", q);
      else params.delete("q");
      if (locationFilter !== "all") params.set("location", locationFilter);
      else params.delete("location");
      if (subiektFilter !== "all") params.set("subiekt", subiektFilter);
      else params.delete("subiekt");
      const next = params.toString();
      if (next !== sp.toString()) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search, locationFilter, subiektFilter, pathname, router, searchParamsRef]);

  const teethScheduleIds = useMemo(
    () => new Set(teethScheduleSupplierIds ?? []),
    [teethScheduleSupplierIds]
  );

  const availableTeethSuppliers = useMemo(() => {
    if (!teethLane || !allSuppliers) return [];
    const needle = teethPickerSearch.trim().toLowerCase();
    return allSuppliers
      .filter((s) => isSupplierActive(s) && !teethScheduleIds.has(s.id))
      .filter((s) => !needle || s.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, "pl"));
  }, [teethLane, allSuppliers, teethScheduleIds, teethPickerSearch]);

  const addSupplierToTeeth = (supplierId: string) => {
    if (blockIfReadOnly()) return;
    start(async () => {
      try {
        await actionAddSupplierToTeethLane(supplierId);
        setTeethPickerOpen(false);
        setTeethPickerSearch("");
        setToast({ text: "Dodano dostawcę do toru zębów", tone: "success" });
        router.refresh();
      } catch (e) {
        setToast(toastFromError(e instanceof Error ? e.message : undefined));
      }
    });
  };

  const removeSupplierFromTeeth = (supplierId: string) => {
    start(async () => {
      try {
        await actionRemoveTeethSchedule(supplierId);
        setTeethRemoveTarget(null);
        setToast({ text: "Usunięto dostawcę z toru zębów", tone: "success" });
        router.refresh();
      } catch (e) {
        setToast(toastFromError(e instanceof Error ? e.message : undefined));
      }
    });
  };

  const sortedRows = useMemo(() => {
    if (!teethLane || teethScheduleIds.size === 0) return rows;
    return [...rows].sort((a, b) => {
      const aHas = teethScheduleIds.has(a.id);
      const bHas = teethScheduleIds.has(b.id);
      if (aHas === bHas) return a.name.localeCompare(b.name, "pl");
      return aHas ? -1 : 1;
    });
  }, [rows, teethLane, teethScheduleIds]);

  const locationScopedRows = useMemo(() => {
    if (locationFilter === "all") return sortedRows;
    return sortedRows.filter((s) => s.location === locationFilter);
  }, [sortedRows, locationFilter]);

  const locationCounts = useMemo(() => countSuppliersByLocation(rows), [rows]);
  const subiektCounts = useMemo(
    () => countSuppliersBySubiektLink(locationScopedRows),
    [locationScopedRows]
  );

  const filtered = useMemo(
    () =>
      filterSuppliersForAdmin(
        sortedRows,
        locationFilter,
        search,
        subiektFilter,
        subiektFilter === "all"
      ),
    [sortedRows, locationFilter, search, subiektFilter]
  );

  const startEdit = (s: SupplierWithSchedule) => {
    if (blockIfReadOnly()) return;
    setForm(supplierToAdminForm(s));
    setFormOpen(true);
  };

  const openNew = () => {
    if (blockIfReadOnly()) return;
    setForm(emptySupplierAdminForm());
    setFormOpen(true);
  };

  const powiazQuery =
    searchParams.get("powiaz") === "1" && !formOpen && !powiazHandled
      ? searchParams.get("q")?.trim() ?? ""
      : "";
  const [appliedPowiazQuery, setAppliedPowiazQuery] = useState("");
  if (powiazQuery && powiazQuery !== appliedPowiazQuery) {
    const match =
      rows.find((row) => row.name.toLowerCase() === powiazQuery.toLowerCase()) ??
      rows.find((row) => row.name.toLowerCase().includes(powiazQuery.toLowerCase()));
    if (match) {
      setAppliedPowiazQuery(powiazQuery);
      setPowiazHandled(true);
      startEdit(match);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("powiaz");
      const next = params.toString();
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
  }

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
    if (!s || blockIfReadOnly()) return;
    start(async () => {
      try {
        await actionSetSupplierActive(s.id, false);
        setRows((list) => list.filter((x) => x.id !== s.id));
        if (form.id === s.id) resetForm();
        setDeactivateTarget(null);
        setToast(
          toastSuccess(
            "Oznaczono jako nieaktywny",
            `Dostawca „${s.name}” nie pojawi się w panelu dziennym.`,
          ),
        );
      } catch (e) {
        setToast(toastFromError(e instanceof Error ? e.message : undefined));
      }
    });
  };

  const save = () => {
    if (blockIfReadOnly()) return;
    if (!form.name.trim()) {
      setToast(SUPPLIER_TOAST.missingName);
      return;
    }
    start(async () => {
      const snapshot = { ...formRef.current };
      try {
        await actionUpsertSupplier(snapshot);
        if (snapshot.id) {
          if (!snapshot.is_active) {
            setRows((list) => list.filter((x) => x.id !== snapshot.id));
          } else {
            setRows((list) =>
              list.map((r) =>
                r.id === snapshot.id ? applyAdminFormToSupplierRow(r, snapshot) : r
              )
            );
          }
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
        setToast(toastFromError(e instanceof Error ? e.message : undefined, SUPPLIER_TOAST.saveFailed.text));
      }
    });
  };

  const sheetTitle = form.id ? form.name || "Edytuj dostawcę" : "Nowy dostawca";
  const sheetDescription = form.id
    ? "Pola poniżej — zapis na dole panelu. Lista kart zostaje widoczna po lewej."
    : "Zapas = na jaki okres robisz większe zamówienie (np. 2 miesiące).";

  const filterActive =
    locationFilter !== "all" || subiektFilter !== "all" || search.trim().length > 0;

  return (
    <>
      {toast ? <NoticeToast notice={toast} onDismiss={dismiss} /> : null}
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
            if (!deleteTarget || blockIfReadOnly()) return;
            start(async () => {
              const r = await actionDeleteSupplier(deleteTarget.id);
              if ("error" in r) {
                setToast(toastFromError(r.error));
                setDeleteTarget(null);
                return;
              }
              setRows((list) => list.filter((x) => x.id !== deleteTarget.id));
              setDeleteTarget(null);
              setToast(SUPPLIER_TOAST.deleted);
            });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!teethRemoveTarget}
        title="Usunąć z toru zębów?"
        message={
          teethRemoveTarget
            ? `„${teethRemoveTarget.name}" zniknie z toru zębów. Karta dostawcy pozostanie w głównym dziale dostaw. Historia i cykl zębów zostaną usunięte.`
            : ""
        }
        confirmLabel="Usuń z toru zębów"
        danger
        pending={pending}
        onCancel={() => setTeethRemoveTarget(null)}
        onConfirm={() => {
          if (!teethRemoveTarget) return;
          removeSupplierFromTeeth(teethRemoveTarget.id);
        }}
      />

      <SupplierEditSheet
        open={formOpen}
        title={sheetTitle}
        description={sheetDescription}
        onClose={resetForm}
        pending={pending}
        footer={
          <>
            {teethLane ? null : (
              <Button type="submit" form="supplier-admin-form" disabled={readOnly || pending}>
                {form.id ? "Zapisz zmiany" : "Dodaj dostawcę"}
              </Button>
            )}
            <Button type="button" variant="ghost" disabled={pending} onClick={resetForm}>
              Zamknij
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
            disabled={readOnly || pending}
            onChange={setForm}
            onPatchCycleFields={patchCycleFields}
            carrierOptions={warehouseCarriers}
            showTeethSchedule={teethLane}
            teethLane={teethLane}
            onTeethScheduleToast={setToast}
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
        {!formOpen ? (
          teethLane ? (
            <AddButton onClick={() => setTeethPickerOpen(true)} disabled={readOnly || pending}>
              Dodaj dostawcę do zębów
            </AddButton>
          ) : (
            <AddButton onClick={openNew} disabled={readOnly}>
              Dodaj dostawcę
            </AddButton>
          )
        ) : null}

        <Card padding={false} className="overflow-hidden">
          <CardHeader
            inset
            density="compact"
            title={`Karty (${filtered.length}${filterActive ? ` z ${rows.length}` : ""})`}
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
            searchId="supplier-card-search"
          />

          {filtered.length === 0 ? (
            <EmptyState
              title="Brak dostawców w tym widoku"
              description={
                teethLane
                  ? search.trim()
                    ? "Zmień wyszukiwanie lub filtry."
                    : "Dodaj istniejącego dostawcę do toru zębów."
                  : search.trim() || subiektFilter !== "all"
                    ? "Zmień wyszukiwanie lub filtry."
                    : "Wybierz inną lokalizację albo dodaj nowego dostawcę."
              }
              action={
                !search.trim() && subiektFilter === "all" && !readOnly ? (
                  teethLane ? (
                    <AddButton onClick={() => setTeethPickerOpen(true)}>
                      Dodaj dostawcę do zębów
                    </AddButton>
                  ) : (
                    <AddButton onClick={openNew}>Dodaj dostawcę</AddButton>
                  )
                ) : undefined
              }
            />
          ) : (
            <>
              <div
                className={cn(
                  "hidden border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 md:grid md:gap-3 lg:px-5",
                  teethLane
                    ? "md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(120px,160px)]"
                    : "md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(88px,100px)_minmax(120px,160px)]"
                )}
                aria-hidden
              >
                <span>Dostawca</span>
                <span>{teethLane ? "Cykl dostaw" : "Cykl"}</span>
                {teethLane ? null : <span>Terminy</span>}
                <span className="text-right">Akcje</span>
              </div>
              <ul className="space-y-1.5 p-2 sm:p-3 lg:p-4">
                {filtered.map((s) => {
                  const isEditing = formOpen && form.id === s.id;
                  const cycleSummary = teethLane
                    ? formatTeethCycleSummary(teethScheduleMap?.[s.id])
                    : formatSupplierCycleSummary(s);
                  const cycleIncomplete = cycleSummary === "Uzupełnij cykl";
                  const isActive = isSupplierActive(s);
                  return (
                    <li
                      key={s.id}
                      id={`supplier-row-${s.id}`}
                      className={cn(
                        "rounded-lg border border-slate-100 bg-white px-3 py-3 transition-all sm:px-4 lg:px-5",
                        "hover:border-slate-200 hover:shadow-sm",
                        !isActive && "opacity-70",
                        s.subiekt_kh_id == null && "border-amber-100/60 bg-amber-50/20",
                        isEditing && "border-indigo-200 bg-indigo-50/60 ring-1 ring-inset ring-indigo-200 shadow-sm"
                      )}
                    >
                      <div
                        className={cn(
                          "flex items-start gap-3 md:grid md:items-center md:gap-3",
                          teethLane
                            ? "md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(120px,160px)]"
                            : "md:grid-cols-[minmax(0,1.6fr)_minmax(120px,180px)_minmax(88px,100px)_minmax(120px,160px)]"
                        )}
                      >
                        <div className="min-w-0 flex-1 md:contents">
                          <div className="min-w-0 md:block">
                            <SupplierAdminNameCell
                              supplier={s}
                              isEditing={isEditing}
                              onEdit={() => startEdit(s)}
                              teethLane={teethLane}
                              trailingBadge={
                                teethLane && !teethScheduleIds.has(s.id) ? (
                                  <Badge variant="warning" className="text-[10px]">
                                    Brak cyklu zębów
                                  </Badge>
                                ) : undefined
                              }
                            />
                            <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500 md:mt-1">
                              <IconMapPin size={12} className="shrink-0 text-slate-400" />
                              {formatSupplierListMeta(s)}
                            </p>
                          </div>
                          <div className="mt-2 md:mt-0">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
                                cycleIncomplete
                                  ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-100"
                                  : "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-100"
                              )}
                            >
                              {cycleSummary}
                            </span>
                          </div>
                          {!teethLane ? (
                          <Link
                            href={scheduleHref(s.location, s.name)}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline md:mt-0 md:text-sm"
                          >
                            Terminy
                            <LinkChevron size={12} tone="sky" className="md:hidden" />
                            <LinkChevron size={14} tone="sky" className="hidden md:inline" />
                          </Link>
                        ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1 md:justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            className="hidden md:inline-flex gap-1.5"
                            disabled={readOnly || pending}
                            onClick={() => startEdit(s)}
                          >
                            <IconPencil size={14} className="shrink-0" />
                            Edytuj
                          </Button>
                          <SupplierAdminRowMenu
                            supplier={s}
                            allowDelete={allowDelete}
                            disabled={readOnly || pending}
                            teethLane={teethLane}
                            onEdit={() => startEdit(s)}
                            onDeactivate={() => {
                              if (blockIfReadOnly()) return;
                              setDeactivateTarget(s);
                            }}
                            onDelete={() => {
                              if (blockIfReadOnly()) return;
                              setDeleteTarget(s);
                            }}
                            onRemoveFromTeeth={() => {
                              if (blockIfReadOnly()) return;
                              setTeethRemoveTarget(s);
                            }}
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

      {teethLane ? (
        <ModalShell
          open={teethPickerOpen}
          onClose={() => { setTeethPickerOpen(false); setTeethPickerSearch(""); }}
          title="Dodaj dostawcę do toru zębów"
          description="Wybierz istniejącego dostawcę, aby utworzyć dla niego osobny cykl zębów — niezależny od zwykłych produktów."
          size="md"
          bodyClassName="p-5 sm:p-6"
        >
          <div className="space-y-4">
            <div className="relative">
              <IconSearch
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={teethPickerSearch}
                onChange={(e) => setTeethPickerSearch(e.target.value)}
                placeholder="Szukaj dostawcy po nazwie…"
                autoFocus
                className="pl-9"
              />
            </div>

            {availableTeethSuppliers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <IconSearch size={18} />
                </span>
                <p className="text-sm text-slate-500">
                  {teethPickerSearch.trim()
                    ? "Brak dostawców pasujących do wyszukiwania."
                    : "Wszyscy aktywni dostawcy są już w torze zębów."}
                </p>
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-slate-400">
                  {availableTeethSuppliers.length}{" "}
                  {availableTeethSuppliers.length === 1 ? "dostępny" : "dostępnych"}
                </p>
                <ul className="max-h-80 space-y-1.5 overflow-y-auto">
                  {availableTeethSuppliers.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => addSupplierToTeeth(s.id)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3.5 py-3 text-left transition-all",
                          "hover:border-indigo-200 hover:bg-indigo-50/40 hover:shadow-sm",
                          "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-100 disabled:hover:bg-white disabled:hover:shadow-none"
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-indigo-100 group-hover:text-indigo-600">
                          <IconMapPin size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {s.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {formatSupplierListMeta(s)}
                          </p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100">
                          <IconPlusCircle size={14} />
                          Dodaj
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </ModalShell>
      ) : null}
    </>
  );
}
