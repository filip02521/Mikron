"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import {
  panelWorkspaceShellClass,
  panelSectionInsetClass,
  panelChromeInsetClass,
  panelSubsectionInsetClass,
  panelStickyChromeClass,
  panelTypography,
  brandIconTileClass,
  checkboxBrandClass,
  tabSelectedClass,
  panelTabIdleClass,
  tabBadgeSelectedClass,
} from "@/lib/ui/ontime-theme";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ModalShell } from "@/components/ui/ModalShell";
import { Toast } from "@/components/ui/Toast";
import { Select, Input } from "@/components/ui/Field";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import {
  IconTruck,
  IconClipboardList,
  IconCircleCheck,
  IconPackage,
  IconCalendar,
  IconTrash2,
} from "@/components/icons/StrokeIcons";
import { formatPlDate } from "@/lib/display-labels";
import type { TeethQueueGroup, TeethQueueItem, TeethQueueEntry, TeethScheduledItem } from "@/lib/data/teeth-queue";
import { isScheduledItem } from "@/lib/data/teeth-queue";
import type { DayOfWeek, TeethSupplierScheduleWithSupplier, IndividualOrderTeethDetail } from "@/types/database";
import { DAY_OF_WEEK_LABELS, DAY_OF_WEEK_SHORT } from "@/lib/data/teeth-schedule";
import { TEETH_KIND_LABELS } from "@/lib/teeth/teeth-catalog";
import { teethManufacturerLabel, groupTeethDetails, type TeethManufacturer } from "@/lib/teeth/teeth-catalog";
import {
  actionMarkTeethOrdered,
  actionFetchTeethHistory,
  actionFetchTeethSchedules,
  actionFetchAvailableSuppliersForTeethSchedule,
  actionUpsertTeethSchedule,
  actionRemoveTeethSchedule,
  actionShiftTeethSchedule,
  actionMarkTeethScheduleOrdered,
  actionOverrideTeethDeliveryDate,
  actionClearTeethDeliveryDateOverride,
} from "@/app/actions/teeth-orders";

type Tab = "kolejka" | "historia" | "harmonogram";

const VALID_TABS: Tab[] = ["kolejka", "historia", "harmonogram"];

function TeethDetailsSummary({ details }: { details: IndividualOrderTeethDetail[] | null }) {
  if (!details || details.length === 0) return null;
  const groups = groupTeethDetails(
    details.map((d) => ({
      position: d.position,
      color: d.color,
      mould: d.mould,
      jaw: d.jaw,
      kind: d.kind,
    })),
  );
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {groups.map((g, i) => {
        const jawLabel = g.jaw === "upper" ? "Góra" : g.jaw === "lower" ? "Dół" : null;
        const kindLabel = g.kind ? TEETH_KIND_LABELS[g.kind] : null;
        const segments: string[] = [];
        if (jawLabel) segments.push(jawLabel);
        if (kindLabel) segments.push(kindLabel);
        segments.push(g.color);
        if (g.mould) segments.push(g.mould);
        const label = g.count > 1 ? `${segments.join(" / ")} ×${g.count}` : segments.join(" / ");
        return (
          <span
            key={i}
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

export function TeethPanelClient({
  initialGroups,
}: {
  initialGroups: TeethQueueGroup[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const initialTab: Tab =
    tabParam && VALID_TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "kolejka";

  const [groups, setGroups] = useState(initialGroups);
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    const p = searchParams.get("tab");
    const next: Tab = p && VALID_TABS.includes(p as Tab) ? (p as Tab) : "kolejka";
    setTab(next);
  }, [searchParams]);

  useEffect(() => {
    setGroups(initialGroups);
  }, [initialGroups]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [deliveryDateOpen, setDeliveryDateOpen] = useState(false);
  const [deliveryDateValue, setDeliveryDateValue] = useState("");

  const totalItems = useMemo(
    () => groups.reduce((sum, g) => sum + g.items.length, 0),
    [groups]
  );

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAllInGroup = useCallback((group: TeethQueueGroup) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const realItems = group.items.filter((item) => !isScheduledItem(item));
      const allSelected = realItems.every((item) => next.has(item.id));
      if (allSelected) {
        realItems.forEach((item) => next.delete(item.id));
      } else {
        realItems.forEach((item) => next.add(item.id));
      }
      return next;
    });
  }, []);

  const handleMarkOrdered = useCallback(async () => {
    setConfirmOpen(false);
    setPending(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await actionMarkTeethOrdered(ids);
      if (result.updated === 0) {
        setToast({
          message: "Nie udało się oznaczyć pozycji — być może zostały już zamówione.",
          tone: "error",
        });
      } else {
        setToast({
          message: result.updated === 1
            ? "1 pozycja oznaczona jako zamówiona"
            : `${result.updated} pozycji oznaczonych jako zamówione`,
          tone: "success",
        });
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd oznaczania zamówionych",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [selectedIds, router]);

  const handleSetDeliveryDate = useCallback(async () => {
    setDeliveryDateOpen(false);
    if (!deliveryDateValue || selectedIds.size === 0) return;
    setPending(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await actionOverrideTeethDeliveryDate(ids, deliveryDateValue);
      setToast({
        message: result.updated === 1
          ? "Ustawiono datę dostawy dla 1 pozycji"
          : `Ustawiono datę dostawy dla ${result.updated} pozycji`,
        tone: "success",
      });
      setSelectedIds(new Set());
      setDeliveryDateValue("");
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd ustawiania daty dostawy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [deliveryDateValue, selectedIds, router]);

  const selectedCount = selectedIds.size;

  const handleMarkScheduleOrdered = useCallback(async (supplierId: string, supplierName: string) => {
    setPending(true);
    try {
      await actionMarkTeethScheduleOrdered(supplierId);
      setToast({
        message: `Oznaczono zamówienie u dostawcy ${supplierName} — harmonogram przesunięty na następny cykl`,
        tone: "success",
      });
      router.refresh();
    } catch (e) {
      setToast({
        message: e instanceof Error ? e.message : "Błąd oznaczania zamówienia",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [router]);

  const tabOptions: { id: Tab; label: string; count?: number }[] = [
    { id: "kolejka", label: "Kolejka", count: tab === "kolejka" ? totalItems : undefined },
    { id: "historia", label: "Historia" },
    { id: "harmonogram", label: "Harmonogram" },
  ];

  return (
    <div className={panelWorkspaceShellClass}>
      <Card padding={false} className="overflow-x-clip">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName={brandIconTileClass}>
              <IconPackage size={20} />
            </SectionHeadingIcon>
          }
          title="Panel zębów"
          hint="Kolejka zamówień na zęby — oznacz pozycje jako zamówione u dostawcy"
          hintAriaLabel="O panelu zębów"
        />

        {/* Pasek zakładek */}
        <div className={panelStickyChromeClass}>
          <div
            role="tablist"
            aria-label="Widok panelu zębów"
            className={cn(
              "flex gap-2 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:py-2.5 [&::-webkit-scrollbar]:hidden",
              panelChromeInsetClass
            )}
          >
            {tabOptions.map(({ id, label, count }) => {
              const selected = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams.toString());
                    if (id === "kolejka") {
                      params.delete("tab");
                    } else {
                      params.set("tab", id);
                    }
                    const qs = params.toString();
                    router.replace(qs ? `/zeby?${qs}` : "/zeby", { scroll: false });
                  }}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-3 py-2 transition sm:min-h-9 sm:py-1.5",
                    panelTypography.tab,
                    selected ? tabSelectedClass : panelTabIdleClass
                  )}
                >
                  {label}
                  {count !== undefined && count > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 tabular-nums",
                        panelTypography.tabBadge,
                        selected ? tabBadgeSelectedClass : "bg-slate-100 text-slate-700"
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Treść */}
        {tab === "kolejka" ? (
          <KolejkaView
            groups={groups}
            selectedIds={selectedIds}
            pending={pending}
            selectedCount={selectedCount}
            onToggleSelect={toggleSelect}
            onToggleSelectAllInGroup={toggleSelectAllInGroup}
            onMarkOrdered={() => setConfirmOpen(true)}
            onSetDeliveryDate={() => setDeliveryDateOpen(true)}
            onMarkScheduleOrdered={handleMarkScheduleOrdered}
          />
        ) : tab === "historia" ? (
          <HistoriaView onToast={setToast} />
        ) : (
          <HarmonogramView
            onToast={setToast}
          />
        )}
      </Card>

      {/* Dialog potwierdzenia */}
      <ConfirmDialog
        open={confirmOpen}
        title="Oznacz jako zamówione"
        message={
          selectedCount === 1
            ? "Czy na pewno chcesz oznaczyć 1 pozycję jako zamówioną u dostawcy?"
            : `Czy na pewno chcesz oznaczyć ${selectedCount} pozycji jako zamówione u dostawcy?`
        }
        confirmLabel="Oznacz zamówione"
        cancelLabel="Anuluj"
        pending={pending}
        onConfirm={handleMarkOrdered}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* Modal ustawiania daty dostawy (kolejka) */}
      <ModalShell
        open={deliveryDateOpen}
        onClose={() => {
          setDeliveryDateOpen(false);
          setDeliveryDateValue("");
        }}
        title="Ustaw datę dostawy"
        description={`Podaj planowaną datę dostawy dla ${selectedCount} ${selectedCount === 1 ? "zaznaczonej pozycji" : "zaznaczonych pozycji"}.`}
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        loadingMessage={pending ? "Zapisywanie…" : null}
        disableBackdropClose={pending}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setDeliveryDateOpen(false);
                setDeliveryDateValue("");
              }}
              disabled={pending}
            >
              Anuluj
            </Button>
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={handleSetDeliveryDate}
              disabled={pending || !deliveryDateValue}
            >
              Zapisz
            </Button>
          </div>
        }
      >
        <Input
          type="date"
          value={deliveryDateValue}
          onChange={(e) => setDeliveryDateValue(e.target.value)}
          className="w-full"
        />
      </ModalShell>

      {/* Toast */}
      {toast ? (
        <Toast
          message={toast.message}
          tone={toast.tone}
          onDismiss={() => setToast(null)}
        />
      ) : null}
    </div>
  );
}

function KolejkaView({
  groups,
  selectedIds,
  pending,
  selectedCount,
  onToggleSelect,
  onToggleSelectAllInGroup,
  onMarkOrdered,
  onSetDeliveryDate,
  onMarkScheduleOrdered,
}: {
  groups: TeethQueueGroup[];
  selectedIds: Set<string>;
  pending: boolean;
  selectedCount: number;
  onToggleSelect: (id: string) => void;
  onToggleSelectAllInGroup: (group: TeethQueueGroup) => void;
  onMarkOrdered: () => void;
  onSetDeliveryDate: () => void;
  onMarkScheduleOrdered: (supplierId: string, supplierName: string) => void;
}) {
  if (!groups.length || groups.every((g) => !g.items.length)) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Brak pozycji w kolejce"
          description="Nie ma nowych próśb na zęby oczekujących na zamówienie u dostawcy."
          icon={<IconClipboardList size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", panelSectionInsetClass)}>
      {/* Pasek akcji zbiorczych */}
      {selectedCount > 0 ? (
        <div className={cn(
          "sticky top-0 z-10 flex items-center justify-between rounded-md border border-indigo-200/80 bg-indigo-50/80 py-2 shadow-sm backdrop-blur-sm",
          panelSubsectionInsetClass
        )}>
          <span className="text-sm font-medium text-indigo-900">
            Zaznaczono {selectedCount} {selectedCount === 1 ? "pozycję" : "pozycji"}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={onSetDeliveryDate}
              disabled={pending}
              className="min-h-9"
            >
              <IconCalendar size={16} strokeWidth={2} />
              Ustaw datę dostawy
            </Button>
            <Button
              size="sm"
              onClick={onMarkOrdered}
              disabled={pending}
              className="min-h-9"
            >
              <IconTruck size={16} strokeWidth={2} />
              Oznacz zamówione
            </Button>
          </div>
        </div>
      ) : null}

      {groups.map((group) => {
        const realItems = group.items.filter((i) => !isScheduledItem(i));
        return (
        <div
          key={group.supplierId ?? "__no_supplier"}
          className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm"
        >
          {/* Nagłówek grupy dostawcy */}
          <div className={cn("flex items-center justify-between border-b border-slate-100 bg-slate-50/50 py-2.5", panelSubsectionInsetClass)}>
            <div className="flex min-w-0 items-center gap-2">
              <span className={panelTypography.sectionTitle}>
                {group.supplierName}
              </span>
              <Badge variant="default" className="text-[10px] font-medium">{group.items.length}</Badge>
              {group.scheduledOnly ? (
                <Badge variant="info" className="text-[10px]">Z harmonogramu</Badge>
              ) : null}
            </div>
            {realItems.length > 0 ? (
              <button
                type="button"
                onClick={() => onToggleSelectAllInGroup(group)}
                className="text-xs font-medium text-indigo-700 transition-colors hover:text-indigo-900"
              >
                {realItems.every((item) => selectedIds.has(item.id))
                  ? "Odznacz wszystkie"
                  : "Zaznacz wszystkie"}
              </button>
            ) : null}
          </div>

          {/* Lista pozycji */}
          <div className="divide-y divide-slate-100">
            {group.items.map((item) => {
              if (isScheduledItem(item)) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 px-2.5 py-2 sm:px-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className={panelTypography.rowTitle}>
                          Zaplanowane zamówienie
                        </span>
                        {item.shift_date ? (
                          <Badge variant="warning" className="text-[10px]">
                            Przesunięte: {formatPlDate(item.shift_date)}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        {item.computed_next_date ? (
                          <span className={panelTypography.rowMeta}>
                            Termin: {formatPlDate(item.computed_next_date)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => onMarkScheduleOrdered(item.supplier_id, item.supplier_name)}
                      disabled={pending}
                      className="min-h-9 shrink-0"
                    >
                      <IconTruck size={16} strokeWidth={2} />
                      Zamów
                    </Button>
                  </div>
                );
              }

              const checked = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 px-2.5 py-2 transition-colors sm:px-3",
                    checked && "bg-indigo-50/40"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSelect(item.id)}
                    className={cn(checkboxBrandClass, "mt-1 shrink-0")}
                    aria-label={`Zaznacz: ${item.products}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className={panelTypography.rowTitle}>
                        {item.products}
                      </span>
                      {item.symbol && item.symbol !== "-" ? (
                        <span className={panelTypography.rowMeta}>
                          {item.symbol}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className={panelTypography.rowMeta}>
                        Ilość: {item.quantity}
                      </span>
                      {item.sales_person_name ? (
                        <span className={panelTypography.rowMeta}>
                          Handlowiec: {item.sales_person_name}
                        </span>
                      ) : null}
                      {item.request_kind === "informacja" ? (
                        <Badge variant="info" className="text-[10px]">Informacja</Badge>
                      ) : null}
                      {item.status === "Weryfikacja" ? (
                        <Badge variant="warning" className="text-[10px]">Weryfikacja</Badge>
                      ) : null}
                    </div>
                    {item.sales_request_note ? (
                      <p className={cn(panelTypography.caption, "mt-1 italic")}>
                        {item.sales_request_note}
                      </p>
                    ) : null}
                    <TeethDetailsSummary details={item.teeth_details ?? null} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
}

function HistoriaView({
  onToast,
}: {
  onToast: (toast: ToastState) => void;
}) {
  const [items, setItems] = useState<TeethQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateValue, setDateValue] = useState("");
  const [datePending, setDatePending] = useState(false);

  const reloadHistory = useCallback(() => {
    actionFetchTeethHistory()
      .then((data) => setItems(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    actionFetchTeethHistory()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Błąd ładowania historii");
        }
      });
    return () => { cancelled = true; };
  }, []);

  const openDateEditor = useCallback((item: TeethQueueItem) => {
    setEditingDateId(item.id);
    setDateValue(item.teeth_delivery_date ?? "");
  }, []);

  const handleSaveDate = useCallback(async () => {
    if (!editingDateId) return;
    setDatePending(true);
    try {
      if (dateValue) {
        await actionOverrideTeethDeliveryDate([editingDateId], dateValue);
        onToast({ message: "Ustawiono datę dostawy", tone: "success" });
      } else {
        await actionClearTeethDeliveryDateOverride([editingDateId]);
        onToast({ message: "Wyczyszczono datę dostawy", tone: "success" });
      }
      setEditingDateId(null);
      setDateValue("");
      reloadHistory();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd ustawiania daty dostawy",
        tone: "error",
      });
    } finally {
      setDatePending(false);
    }
  }, [editingDateId, dateValue, reloadHistory, onToast]);

  const handleClearDate = useCallback(async () => {
    if (!editingDateId) return;
    setDatePending(true);
    try {
      await actionClearTeethDeliveryDateOverride([editingDateId]);
      onToast({ message: "Wyczyszczono datę dostawy", tone: "success" });
      setEditingDateId(null);
      setDateValue("");
      reloadHistory();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd czyszczenia daty dostawy",
        tone: "error",
      });
    } finally {
      setDatePending(false);
    }
  }, [editingDateId, reloadHistory, onToast]);

  if (error) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Błąd ładowania historii"
          description={error}
          icon={<IconCircleCheck size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  if (items === null) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Ładowanie historii…"
          icon={<IconCircleCheck size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Brak historii zamówień zębów"
          description="Zamówione pozycje pojawią się tutaj po oznaczeniu w kolejce."
          icon={<IconCircleCheck size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  return (
    <>
    <div className={cn("space-y-3", panelSectionInsetClass)}>
    <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 px-2.5 py-2 sm:px-3"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className={panelTypography.rowTitle}>
                  {item.products}
                </span>
                {item.symbol && item.symbol !== "-" ? (
                  <span className={panelTypography.rowMeta}>
                    {item.symbol}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                <span className={panelTypography.rowMeta}>
                  {item.supplier_name ?? "Bez dostawcy"}
                </span>
                {item.sales_person_name ? (
                  <span className={panelTypography.rowMeta}>
                    Handlowiec: {item.sales_person_name}
                  </span>
                ) : null}
                {item.teeth_ordered_at ? (
                  <span className={panelTypography.rowMeta}>
                    Zamówiono: {new Date(item.teeth_ordered_at).toLocaleDateString("pl-PL")}
                  </span>
                ) : null}
                {item.teeth_delivery_date ? (
                  <span className={panelTypography.rowMeta}>
                    Planowana dostawa: {formatPlDate(item.teeth_delivery_date)}
                  </span>
                ) : null}
              </div>
              <TeethDetailsSummary details={item.teeth_details ?? null} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => openDateEditor(item)}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                title="Zmień datę dostawy"
              >
                <IconCalendar size={16} strokeWidth={1.75} />
              </button>
              <Badge variant="success" className="text-[10px]">Zamówione</Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
    </div>

    {/* Modal zmiany daty dostawy */}
    <ModalShell
      open={editingDateId !== null}
      onClose={() => {
        setEditingDateId(null);
        setDateValue("");
      }}
      title="Zmień datę dostawy"
      description="Podaj planowaną datę dostawy. Pozostaw puste i kliknij „Wyczyść”, aby wrócić do automatycznego szacunku."
      size="sm"
      tier="raised"
      bodyClassName="px-5 py-4 sm:px-6"
      loadingMessage={datePending ? "Zapisywanie…" : null}
      disableBackdropClose={datePending}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={() => {
              setEditingDateId(null);
              setDateValue("");
            }}
            disabled={datePending}
          >
            Anuluj
          </Button>
          {dateValue ? (
            <Button
              variant="ghost"
              className="min-h-11 w-full text-red-600 hover:text-red-700 sm:w-auto"
              onClick={handleClearDate}
              disabled={datePending}
            >
              Wyczyść
            </Button>
          ) : null}
          <Button
            className="min-h-11 w-full sm:w-auto"
            onClick={handleSaveDate}
            disabled={datePending}
          >
            Zapisz
          </Button>
        </div>
      }
    >
      <Input
        type="date"
        value={dateValue}
        onChange={(e) => setDateValue(e.target.value)}
        className="w-full"
      />
    </ModalShell>
    </>
  );
}

type ToastState = { message: string; tone: "success" | "error" } | null;

function HarmonogramView({
  onToast,
}: {
  onToast: (toast: ToastState) => void;
}) {
  const [schedules, setSchedules] = useState<TeethSupplierScheduleWithSupplier[] | null>(null);
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Form state for adding a new supplier
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(1);
  const [selectedInterval, setSelectedInterval] = useState(1);

  // Shift dialog state
  const [shiftSupplierId, setShiftSupplierId] = useState<string | null>(null);
  const [shiftDate, setShiftDate] = useState("");
  const [confirmShiftOpen, setConfirmShiftOpen] = useState(false);

  // Remove confirm
  const [removeSupplierId, setRemoveSupplierId] = useState<string | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [schedResult, suppliers] = await Promise.all([
        actionFetchTeethSchedules(),
        actionFetchAvailableSuppliersForTeethSchedule(),
      ]);
      setSchedules(schedResult.schedules);
      setAvailableSuppliers(suppliers);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd ładowania harmonogramu");
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddSupplier = useCallback(async () => {
    if (!selectedSupplierId) return;
    setPending(true);
    try {
      await actionUpsertTeethSchedule(selectedSupplierId, selectedDay, selectedInterval);
      onToast({
        message: "Dodano dostawcę do harmonogramu zębów",
        tone: "success",
      });
      setSelectedSupplierId("");
      setSelectedDay(1);
      setSelectedInterval(1);
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd dodawania dostawcy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [selectedSupplierId, selectedDay, selectedInterval, loadData, onToast]);

  const handleUpdateSchedule = useCallback(
    async (supplierId: string, day: DayOfWeek, interval: number) => {
      setPending(true);
      try {
        await actionUpsertTeethSchedule(supplierId, day, interval);
        onToast({ message: "Zaktualizowano harmonogram", tone: "success" });
        await loadData();
      } catch (e) {
        onToast({
          message: e instanceof Error ? e.message : "Błąd aktualizacji harmonogramu",
          tone: "error",
        });
      } finally {
        setPending(false);
      }
    },
    [loadData, onToast]
  );

  const handleRemoveSchedule = useCallback(async () => {
    if (!removeSupplierId) return;
    setConfirmRemoveOpen(false);
    setPending(true);
    try {
      await actionRemoveTeethSchedule(removeSupplierId);
      onToast({ message: "Usunięto dostawcę z harmonogramu", tone: "success" });
      setRemoveSupplierId(null);
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd usuwania dostawcy",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [removeSupplierId, loadData, onToast]);

  const handleShiftSchedule = useCallback(async (overrideDate?: string) => {
    if (!shiftSupplierId) return;
    setConfirmShiftOpen(false);
    setPending(true);
    try {
      const dateToSave = overrideDate !== undefined ? overrideDate : shiftDate;
      await actionShiftTeethSchedule(
        shiftSupplierId,
        dateToSave || null
      );
      onToast({
        message: dateToSave
          ? `Przesunięto na ${formatPlDate(dateToSave)}`
          : "Wyczyszczono przesunięcie harmonogramu",
        tone: "success",
      });
      setShiftSupplierId(null);
      setShiftDate("");
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd przesuwania harmonogramu",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [shiftSupplierId, shiftDate, loadData, onToast]);

  const handleMarkScheduleOrdered = useCallback(async (supplierId: string, supplierName: string) => {
    setPending(true);
    try {
      await actionMarkTeethScheduleOrdered(supplierId);
      onToast({
        message: `Oznaczono zamówienie u dostawcy ${supplierName} — harmonogram przesunięty na następny cykl`,
        tone: "success",
      });
      await loadData();
    } catch (e) {
      onToast({
        message: e instanceof Error ? e.message : "Błąd oznaczania zamówienia",
        tone: "error",
      });
    } finally {
      setPending(false);
    }
  }, [loadData, onToast]);

  if (error) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Błąd ładowania harmonogramu"
          description={error}
          icon={<IconCalendar size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  if (schedules === null) {
    return (
      <Card padding={false}>
        <EmptyState
          title="Ładowanie harmonogramu…"
          icon={<IconCalendar size={28} strokeWidth={1.75} />}
        />
      </Card>
    );
  }

  return (
    <div className={cn("space-y-3", panelSectionInsetClass)}>
      {/* Dodawanie dostawcy */}
      {availableSuppliers.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
          <CardHeader
            inset
            density="compact"
            leading={
              <SectionHeadingIcon tileClassName="bg-indigo-100 text-indigo-800">
                <IconCalendar size={18} strokeWidth={1.75} />
              </SectionHeadingIcon>
            }
            title="Dodaj dostawcę do harmonogramu"
          />
          <div className={cn(panelSubsectionInsetClass, "space-y-3 py-3")}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[12rem] flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Dostawca
                </label>
                <Select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full"
                >
                  <option value="">Wybierz dostawcę…</option>
                  {availableSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Dzień zamówienia
                </label>
                <Select
                  value={String(selectedDay)}
                  onChange={(e) => setSelectedDay(Number(e.target.value) as DayOfWeek)}
                >
                  {([1, 2, 3, 4, 5] as DayOfWeek[]).map((d) => (
                    <option key={d} value={String(d)}>
                      {DAY_OF_WEEK_LABELS[d]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Interwał
                </label>
                <Select
                  value={String(selectedInterval)}
                  onChange={(e) => setSelectedInterval(Number(e.target.value))}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n === 1 ? "Co tydzień" : `Co ${n} tyg.`}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                size="sm"
                onClick={handleAddSupplier}
                disabled={pending || !selectedSupplierId}
                className="min-h-9"
              >
                Dodaj
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lista harmonogramów */}
      {schedules.length === 0 ? (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
          <EmptyState
            title="Brak dostawców w harmonogramie"
            description="Dodaj dostawcę powyżej, aby ustalić cykliczny harmonogram zamówień zębowych."
            icon={<IconCalendar size={28} strokeWidth={1.75} />}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-slate-200/80 bg-[var(--card)] shadow-sm">
          <CardHeader
            inset
            density="compact"
            title="Harmonogram dostawców"
          />
          <div className="divide-y divide-slate-100">
            {schedules.map((sched) => (
              <div
                key={sched.id}
                className={cn("space-y-2 px-2.5 py-2 sm:px-3")}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={panelTypography.rowTitle}>
                      {sched.supplier_name}
                    </span>
                    {sched.computed_next_date ? (
                      <Badge variant="info" className="text-[10px]">
                        Następne: {formatPlDate(sched.computed_next_date)}
                      </Badge>
                    ) : null}
                    {sched.shift_date ? (
                      <Badge variant="warning" className="text-[10px]">
                        Przesunięte: {formatPlDate(sched.shift_date)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {sched.computed_next_date ? (
                      <Button
                        size="sm"
                        variant="primary"
                        className="min-h-9"
                        onClick={() => handleMarkScheduleOrdered(sched.supplier_id, sched.supplier_name)}
                        disabled={pending}
                      >
                        Zamów
                      </Button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setShiftSupplierId(sched.supplier_id);
                        setShiftDate(sched.shift_date ?? "");
                        setConfirmShiftOpen(true);
                      }}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      title="Przesuń jednorazowo"
                    >
                      <IconCalendar size={16} strokeWidth={1.75} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveSupplierId(sched.supplier_id);
                        setConfirmRemoveOpen(true);
                      }}
                      className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Usuń z harmonogramu"
                    >
                      <IconTrash2 size={16} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      Dzień:
                    </label>
                    <Select
                      value={String(sched.order_day_of_week)}
                      onChange={(e) =>
                        handleUpdateSchedule(
                          sched.supplier_id,
                          Number(e.target.value) as DayOfWeek,
                          sched.interval_weeks
                        )
                      }
                      className="min-w-[8rem]"
                      disabled={pending}
                    >
                      {([1, 2, 3, 4, 5] as DayOfWeek[]).map((d) => (
                        <option key={d} value={String(d)}>
                          {DAY_OF_WEEK_SHORT[d]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-slate-500">
                      Interwał:
                    </label>
                    <Select
                      value={String(sched.interval_weeks)}
                      onChange={(e) =>
                        handleUpdateSchedule(
                          sched.supplier_id,
                          sched.order_day_of_week,
                          Number(e.target.value)
                        )
                      }
                      className="min-w-[7rem]"
                      disabled={pending}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={String(n)}>
                          {n === 1 ? "Co tydzień" : `Co ${n} tyg.`}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {sched.last_order_date ? (
                    <span className={panelTypography.rowMeta}>
                      Ostatnie zamówienie: {formatPlDate(sched.last_order_date)}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog przesuwania */}
      <ModalShell
        open={confirmShiftOpen}
        onClose={() => {
          setConfirmShiftOpen(false);
          setShiftSupplierId(null);
          setShiftDate("");
        }}
        title="Przesuń jednorazowo harmonogram"
        description="Podaj datę, na którą chcesz przesunąć następne zamówienie. Pozostaw puste i kliknij Wyczyść, aby wrócić do automatycznego wyliczenia."
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        loadingMessage={pending ? "Przetwarzanie…" : null}
        disableBackdropClose={pending}
        footer={
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="min-h-11 w-full sm:w-auto"
              onClick={() => {
                setConfirmShiftOpen(false);
                setShiftSupplierId(null);
                setShiftDate("");
              }}
              disabled={pending}
            >
              Anuluj
            </Button>
            {shiftDate ? (
              <Button
                variant="ghost"
                className="min-h-11 w-full text-red-600 hover:text-red-700 sm:w-auto"
                onClick={() => handleShiftSchedule("")}
                disabled={pending}
              >
                Wyczyść
              </Button>
            ) : null}
            <Button
              className="min-h-11 w-full sm:w-auto"
              onClick={() => handleShiftSchedule()}
              disabled={pending}
            >
              {shiftDate ? "Przesuń" : "Zapisz"}
            </Button>
          </div>
        }
      >
        <Input
          type="date"
          value={shiftDate}
          onChange={(e) => setShiftDate(e.target.value)}
          className="w-full"
        />
      </ModalShell>

      {/* Dialog usuwania */}
      <ConfirmDialog
        open={confirmRemoveOpen}
        title="Usuń dostawcę z harmonogramu"
        message="Czy na pewno chcesz usunąć tego dostawcę z harmonogramu zębów? Historia zamówień pozostanie zachowana."
        confirmLabel="Usuń"
        cancelLabel="Anuluj"
        pending={pending}
        onConfirm={handleRemoveSchedule}
        onCancel={() => {
          setConfirmRemoveOpen(false);
          setRemoveSupplierId(null);
        }}
      />
    </div>
  );
}
