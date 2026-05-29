"use client";

import { Fragment, useMemo, useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import { actionBatchUpdateDelivered, actionUpdateDelivered } from "@/app/actions/admin";
import { getDeliveryProgress, parseOrderQuantity } from "@/lib/orders/individual";
import { procurementDispositionQueueLabel } from "@/lib/orders/procurement-disposition";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import {
  IconAvailability,
  IconTruck,
  IconWarehouse,
} from "@/components/icons/StrokeIcons";
import { QueuePanelHelp } from "@/components/queue/QueuePanelHelp";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";
import { checkboxBrandClass, controlFocusClass } from "@/lib/ui/ontime-theme";
import { InformacjaQueueSection } from "@/components/queue/InformacjaQueueSection";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { QueuePanelToolbar } from "@/components/queue/QueuePanelToolbar";
import { WarehouseInventorySection } from "@/components/queue/WarehouseInventorySection";
import { DeliveryJournalSection } from "@/components/queue/DeliveryJournalSection";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { buildWarehouseInventoryRows } from "@/lib/orders/warehouse-inventory";
import { partialReceiveCrossLabel } from "@/lib/orders/warehouse-cross-link";
import { countOrdersBySupplier, filterOrdersBySupplier } from "@/lib/orders/supplier-filter-summary";
import { summarizeQueueInbox } from "@/lib/orders/queue-inbox";
import { SupplierFilterChips } from "@/components/queue/SupplierFilterChips";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { buildSupplierGroupMetrics, formatSupplierGroupHeaderSummary } from "@/lib/orders/supplier-group-metrics";
import { useSupplierGroupCollapse } from "@/lib/orders/use-supplier-group-collapse";
import {
  groupOrdersBySupplier,
  queueSupplierLeadingCellClass,
  queueSupplierRowClass,
  supplierKey,
} from "@/lib/orders/queue-supplier-groups";
import {
  batchNotifyButtonLabel,
  countSalesPeopleInOrders,
  formatDeliveryBatchToast,
  selectedSaveButtonLabel,
} from "@/lib/orders/queue-batch-notify";

type QueueView = "receive" | "journal" | "inventory";

export function QueueClient({
  orders,
  informacjaOrders,
  pickupReadyCount,
  warehouseInventory,
  deliveryJournal,
  journalSuppliers,
  isMagazynRole = false,
}: {
  orders: IndividualOrder[];
  informacjaOrders: IndividualOrder[];
  pickupReadyCount: number;
  warehouseInventory: IndividualOrder[];
  deliveryJournal: {
    date: string;
    receipts: WarehouseDeliveryReceipt[];
    summary: { receiptCount: number; packageCount: number; palletCount: number };
  };
  journalSuppliers: Array<{ id: string; name: string; subiektKhId: number | null }>;
  isMagazynRole?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<QueueView>("receive");
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const [supplierFilter, setSupplierFilter] = useState("");

  const dismissToast = useCallback(() => setToast(null), []);

  const inventoryCount = useMemo(
    () => buildWarehouseInventoryRows(warehouseInventory).length,
    [warehouseInventory]
  );

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      let next: QueueView = "receive";
      if (hash === "#inwentaryzacja") next = "inventory";
      else if (hash === "#dziennik-dostaw") next = "journal";
      setView(next);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (view !== "inventory") return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById("inwentaryzacja")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const setQueueView = useCallback((next: QueueView) => {
    setView(next);
    const hash =
      next === "inventory" ? "#inwentaryzacja" : next === "journal" ? "#dziennik-dostaw" : "";
    const target = hash
      ? `${window.location.pathname}${window.location.search}${hash}`
      : `${window.location.pathname}${window.location.search}`;
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== target) {
      window.history.replaceState(null, "", target);
    }
  }, []);

  const shelf = useMemo(
    () => orders.filter((o) => !o.sales_cancelled_at || o.procurement_cancel_disposition),
    [orders]
  );
  const shelfFiltered = useMemo(
    () => filterOrdersBySupplier(shelf, supplierFilter),
    [shelf, supplierFilter]
  );
  const deliverySupplierChips = useMemo(() => countOrdersBySupplier(shelf), [shelf]);
  const deliveryGroups = useMemo(
    () => groupOrdersBySupplier(shelfFiltered),
    [shelfFiltered]
  );
  const supplierMetrics = useMemo(
    () => buildSupplierGroupMetrics(shelf, warehouseInventory),
    [shelf, warehouseInventory]
  );
  const inboxSummary = useMemo(() => summarizeQueueInbox(orders), [orders]);

  const deliveryCollapse = useSupplierGroupCollapse(deliveryGroups, supplierFilter);

  const getQty = (o: IndividualOrder) => {
    if (qty[o.id] !== undefined) return qty[o.id];
    const d = o.delivered_quantity;
    if (d && d !== "-") return d;
    return "";
  };

  const selectedIds = useMemo(
    () => shelfFiltered.filter((o) => selected[o.id]).map((o) => o.id),
    [shelfFiltered, selected]
  );

  const toggleSelected = (orderId: string) => {
    setSelected((s) => ({ ...s, [orderId]: !s[orderId] }));
  };

  const toggleSupplierGroupIds = (ids: string[], checked: boolean) => {
    setSelected((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = checked;
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected((s) => {
      if (!checked) return {};
      const next: Record<string, boolean> = {};
      for (const o of shelfFiltered) next[o.id] = true;
      return next;
    });
  };

  const allSelected =
    shelfFiltered.length > 0 && shelfFiltered.every((o) => selected[o.id]);

  const saveDelivery = (order: IndividualOrder, value: string) => {
    setPendingMessage("Zapisywanie dostawy…");
    start(async () => {
      try {
        const result = await actionUpdateDelivered(order.id, value);
        setQty((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        const progress = getDeliveryProgress(order.quantity, value);
        const person = order.sales_person?.name ?? "handlowiec";

        if (result.emailError) {
          setToast({
            text: `Zapisano dostawę, ale e-mail nie poszedł: ${result.emailError}`,
            tone: "error",
          });
        } else if (progress.remaining === 0 && progress.hasNumericQty) {
          setToast({
            text: result.emailSent
              ? `Zrealizowano · ${person} · wysłano e-mail`
              : `Zrealizowano · ${person}`,
            tone: "success",
          });
        } else if (progress.delivered > 0 && progress.hasNumericQty) {
          setToast({
            text: result.emailSent
              ? `${progress.fractionLabel} · ${person} · brakuje ${progress.remaining} szt. · wysłano e-mail`
              : `${progress.fractionLabel} · ${person} · brakuje ${progress.remaining} szt.`,
            tone: "success",
          });
        } else {
          setToast({
            text: result.emailSent ? "Zapisano · wysłano e-mail" : "Zapisano",
            tone: "success",
          });
        }
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
  };

  const saveBatch = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    const updates = orderIds
      .map((id) => {
        const order = shelf.find((o) => o.id === id);
        if (!order) return null;
        const ordered = parseOrderQuantity(order.quantity);
        const value = opts?.fullQuantity && ordered != null ? String(ordered) : getQty(order);
        if (!value.trim()) return null;
        return { orderId: id, qty: value };
      })
      .filter((u): u is { orderId: string; qty: string } => u != null);

    const skippedQty = orderIds.length - updates.length;

    if (!updates.length) {
      setToast({ text: "Wpisz ilość w kolumnie „Dost.” lub użyj „Całość”.", tone: "error" });
      return;
    }

    setPendingMessage(
      updates.length > 1 ? "Zbiorczy zapis dostaw…" : "Zapisywanie dostawy…"
    );
    start(async () => {
      try {
        if (updates.length === 1 && orderIds.length === 1) {
          const only = updates[0]!;
          const result = await actionUpdateDelivered(only.orderId, only.qty);
          setSelected((s) => {
            const next = { ...s };
            delete next[only.orderId];
            return next;
          });
          setQty((s) => {
            const next = { ...s };
            delete next[only.orderId];
            return next;
          });
          const order = shelf.find((o) => o.id === only.orderId);
          const person = order?.sales_person?.name ?? "handlowiec";
          setToast({
            text: result.emailError
              ? `Zapisano, ale e-mail: ${result.emailError}`
              : result.emailSent
                ? `Zapisano · ${person} · wysłano mail`
                : `Zapisano · ${person}`,
            tone: result.emailError ? "error" : "success",
          });
        } else {
          const result = await actionBatchUpdateDelivered(updates);
          if ("error" in result) {
            setToast({ text: result.error, tone: "error" });
            return;
          }
          setSelected((s) => {
            const next = { ...s };
            for (const id of result.savedOrderIds) delete next[id];
            return next;
          });
          setQty((s) => {
            const next = { ...s };
            for (const id of result.savedOrderIds) delete next[id];
            return next;
          });
          const toast = formatDeliveryBatchToast(result);
          if (skippedQty > 0) {
            toast.text += ` · ${skippedQty} bez ilości (pominięto)`;
            toast.tone = "error";
          }
          setToast(toast);
        }
        router.refresh();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "Nie udało się zapisać",
          tone: "error",
        });
      } finally {
        setPendingMessage(null);
      }
    });
  };

  const partialCount = inboxSummary.partialCount;
  const cancelLabelled = inboxSummary.cancelLabelledCount;

  const deliveryHint = shelf.length
    ? `${pickupReadyCount} na regale do odbioru · ${partialCount} częściowo przyjęte · ${deliverySupplierChips.length} dostawców${cancelLabelled ? ` · ${cancelLabelled} z rezygnacją` : ""}`
    : "Po zamówieniu u dostawcy w panelu dziennym";

  return (
    <div className="relative mx-auto max-w-6xl">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          leading={
            <SectionHeadingIcon tileClassName="bg-emerald-100 text-emerald-800">
              <IconWarehouse size={20} />
            </SectionHeadingIcon>
          }
          title="Magazyn i regał"
          description="Przyjęcie towaru dla handlowców oraz powiadomienia o dostępności na magazynie."
          action={<QueuePanelHelp />}
        />

        <QueuePanelToolbar
          summary={inboxSummary}
          informacjaCount={informacjaOrders.length}
          pickupReadyCount={pickupReadyCount}
          inventoryCount={inventoryCount}
          journalCount={deliveryJournal.summary.receiptCount}
          onOpenInventory={() => setQueueView("inventory")}
          onOpenJournal={() => setQueueView("journal")}
          showProcurementLinks={!isMagazynRole}
        />

        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <SegmentedControl<QueueView>
            ariaLabel="Widok magazynu"
            value={view}
            onChange={setQueueView}
            touchFriendly
            className="w-full sm:w-auto"
            options={[
              { value: "receive", label: "Przyjęcie towaru" },
              {
                value: "journal",
                label:
                  deliveryJournal.summary.receiptCount > 0
                    ? `Dziennik dostaw (${deliveryJournal.summary.receiptCount})`
                    : "Dziennik dostaw",
                title: "Kurier, paczki, palety — zamiast Excela",
              },
              {
                value: "inventory",
                label:
                  inventoryCount > 0
                    ? `Inwentaryzacja regału (${inventoryCount})`
                    : "Inwentaryzacja regału",
                title: "Co leży na magazynie i kto nie odbiera towaru",
              },
            ]}
          />
        </div>

        {view === "journal" ? (
          <DeliveryJournalSection
            suppliers={journalSuppliers}
            initialJournal={deliveryJournal}
            todayDateKey={deliveryJournal.date}
            isMagazynRole={isMagazynRole}
          />
        ) : view === "inventory" ? (
          <WarehouseInventorySection
            orders={warehouseInventory}
            deliveryQueueOrders={shelf}
          />
        ) : (
          <>
        <section className="scroll-mt-20">
          <SectionListLabel
            id="dostawy-handlowcy"
            title="Dostawy dla handlowców"
            hint={deliveryHint}
            count={supplierFilter ? shelfFiltered.length : shelf.length}
            accent="emerald"
            icon={<IconTruck size={17} />}
            tileClassName="bg-emerald-100 text-emerald-800"
          />
          {shelf.length > 0 ? (
            <div className="space-y-3 border-b border-slate-100 px-4 py-3 sm:px-6">
              <SupplierFilterChips
                chips={deliverySupplierChips}
                value={supplierFilter}
                onChange={setSupplierFilter}
                totalLabel="Kolejka — wszyscy"
              />
              {deliveryGroups.length > 1 ? (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      deliveryCollapse.allExpanded
                        ? deliveryCollapse.collapseAll()
                        : deliveryCollapse.expandAll()
                    }
                  >
                    {deliveryCollapse.allExpanded ? "Zwiń dostawców" : "Rozwiń dostawców"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {selectedIds.length > 0 ? (
            <div className="flex justify-end border-b border-emerald-100 bg-emerald-50/40 px-3 py-2 sm:px-4">
              <Button
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => saveBatch(selectedIds)}
              >
                {selectedSaveButtonLabel(selectedIds.length)}
                {selectedIds.length > 1
                  ? countSalesPeopleInOrders(shelf, selectedIds) === 1
                    ? " · mail do handlowca"
                    : ` · ${countSalesPeopleInOrders(shelf, selectedIds)} handlowców`
                  : ""}
              </Button>
            </div>
          ) : null}

          {!shelf.length ? (
            <EmptyState
              title="Kolejka dostaw jest pusta"
              description="Tu trafiają zamówienia już złożone u dostawcy. Gdy towar dotrze, wpisz ilość na liście i zapisz — wtedy handlowiec dostanie informację."
            />
          ) : !shelfFiltered.length ? (
            <EmptyState
              title="Brak pozycji dla wybranego dostawcy"
              description="Wybierz innego dostawcę lub pokaż całą kolejkę."
            />
          ) : (
            <TableScroll className="px-0 pb-0">
              <DataTable className="queue-table text-sm">
                <thead>
                  <tr>
                    <th className="w-10">
                      <input
                        type="checkbox"
                        className={cn("size-4", checkboxBrandClass)}
                        checked={allSelected}
                        disabled={pending || !shelfFiltered.length}
                        aria-label="Zaznacz wszystkie pozycje"
                        onChange={(e) => toggleAll(e.target.checked)}
                      />
                    </th>
                    <th className="min-w-[7rem]">Dla kogo</th>
                    <th className="min-w-[6rem]">Dostawca</th>
                    <th className="min-w-[10rem]">Produkt</th>
                    <th className="w-12 text-center">Zam.</th>
                    <th className="w-16 text-center">Dost.</th>
                    <th className="w-12 text-center">Brak.</th>
                    <th className="w-[7.5rem] text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryGroups.map((group, groupIndex) => {
                    const groupIds = group.orders.map((o) => o.id);
                    const groupAllSelected =
                      groupIds.length > 0 && groupIds.every((id) => selected[id]);
                    const isOpen = deliveryCollapse.isExpanded(group.supplierKey);
                    const summary = formatSupplierGroupHeaderSummary(
                      group.orders,
                      supplierMetrics.get(group.supplierKey)
                    );

                    return (
                      <Fragment key={group.supplierKey}>
                        <SupplierGroupHeaderRow
                          colSpan={8}
                          groupIndex={groupIndex}
                          group={group}
                          summary={summary}
                          isOpen={isOpen}
                          onToggle={() => deliveryCollapse.toggle(group.supplierKey)}
                          variant="delivery"
                          actions={
                            group.orders.length > 1 ? (
                              <>
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                                  disabled={pending}
                                  onClick={() =>
                                    toggleSupplierGroupIds(groupIds, !groupAllSelected)
                                  }
                                >
                                  {groupAllSelected
                                    ? "Odznacz grupę"
                                    : `Zaznacz (${groupIds.length})`}
                                </button>
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                                  disabled={pending}
                                  title={batchNotifyButtonLabel(shelf, groupIds, {
                                    prefix: "Całość",
                                  })}
                                  onClick={() =>
                                    saveBatch(groupIds, { fullQuantity: true })
                                  }
                                >
                                  {batchNotifyButtonLabel(shelf, groupIds, {
                                    prefix: "Całość",
                                  })}
                                </button>
                              </>
                            ) : null
                          }
                        />
                        {isOpen
                          ? group.orders.map((o, rowIndex) => {
                              const personName = o.sales_person?.name?.trim() || "—";
                              const partialCross = partialReceiveCrossLabel(o);
                              const ordered = parseOrderQuantity(o.quantity);
                              const inputVal = getQty(o);
                              const previewN = inputVal === "" ? 0 : parseInt(inputVal, 10);
                              const progress = getDeliveryProgress(
                                o.quantity,
                                Number.isFinite(previewN) ? String(previewN) : "0"
                              );
                              const isPartial = o.status === "Czesciowo_zrealizowane";
                              const salesCancelRow = Boolean(o.sales_cancelled_at);
                              const zakupyLabel = procurementDispositionQueueLabel(o);
                              const productTitle = [
                                o.products,
                                o.symbol && o.symbol !== "-" ? `(${o.symbol})` : null,
                              ]
                                .filter(Boolean)
                                .join(" ");

                              return (
                                <tr
                                  key={o.id}
                                  className={cn(
                                    queueSupplierRowClass(groupIndex, {
                                      variant: "delivery",
                                      isPartial,
                                      isFirstInSupplierGroup: rowIndex === 0,
                                    }),
                                    salesCancelRow && "bg-amber-50/50"
                                  )}
                                  title={
                                    isPartial && progress.hasNumericQty
                                      ? `Częściowo zrealizowane — czeka na ${progress.remaining} szt.`
                                      : undefined
                                  }
                                >
                                  <td
                                    className={cn(
                                      "text-center align-top pt-3",
                                      queueSupplierLeadingCellClass(groupIndex, {
                                        variant: "delivery",
                                      })
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      className={cn("size-4", checkboxBrandClass)}
                                      checked={!!selected[o.id]}
                                      disabled={pending}
                                      aria-label={`Zaznacz pozycję ${personName}`}
                                      onChange={() => toggleSelected(o.id)}
                                    />
                                  </td>
                                  <td className="whitespace-nowrap font-semibold text-slate-900">
                                    {personName}
                                    {salesCancelRow ? (
                                      <span className="ml-1 text-[10px] font-bold uppercase text-amber-800">
                                        rezygn.
                                      </span>
                                    ) : isPartial ? (
                                      <span className="ml-1 text-[10px] font-bold uppercase text-amber-700">
                                        część
                                      </span>
                                    ) : null}
                                  </td>
                                  <td className="max-w-[8rem] text-slate-400" aria-hidden>
                                    —
                                  </td>
                                  <td className="max-w-[14rem]">
                                    <span
                                      className="line-clamp-2 text-slate-800"
                                      title={productTitle}
                                    >
                                      {o.products}
                                    </span>
                                    {o.symbol && o.symbol !== "-" ? (
                                      <span className="text-xs text-slate-500">{o.symbol}</span>
                                    ) : null}
                                    {partialCross ? (
                                      <p className="mt-1 text-[11px] font-medium leading-snug text-amber-800">
                                        {partialCross}
                                      </p>
                                    ) : null}
                                    {zakupyLabel ? (
                                      <p
                                        className={cn(
                                          "mt-1 text-[11px] leading-snug font-medium",
                                          o.procurement_cancel_disposition === "return"
                                            ? "text-violet-900"
                                            : "text-emerald-900"
                                        )}
                                      >
                                        {zakupyLabel}
                                      </p>
                                    ) : null}
                                  </td>
                                  <td className="text-center tabular-nums font-medium text-slate-800">
                                    {ordered ?? o.quantity}
                                  </td>
                                  <td className="text-center">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="0"
                                      disabled={pending}
                                      value={inputVal}
                                      onChange={(e) =>
                                        setQty((s) => ({ ...s, [o.id]: e.target.value }))
                                      }
                                      className={cn(
                                        "w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-sm font-semibold tabular-nums text-slate-900 disabled:opacity-50",
                                        controlFocusClass
                                      )}
                                      aria-label={`Dostarczono dla ${personName}`}
                                    />
                                  </td>
                                  <td
                                    className={cn(
                                      "text-center tabular-nums font-bold",
                                      progress.remaining && progress.remaining > 0
                                        ? "text-amber-700"
                                        : progress.delivered > 0 && progress.hasNumericQty
                                          ? "text-emerald-700"
                                          : "text-slate-400"
                                    )}
                                  >
                                    {progress.hasNumericQty ? progress.remaining : "—"}
                                  </td>
                                  <td>
                                    <div className="flex justify-end gap-1">
                                      {ordered != null && ordered > 0 ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="!px-2 !py-1 text-xs"
                                          disabled={pending}
                                          onClick={() => saveDelivery(o, String(ordered))}
                                          title={`Dostarczono w całości: ${ordered} szt.`}
                                        >
                                          Całość
                                        </Button>
                                      ) : null}
                                      <Button
                                        variant="primary"
                                        size="sm"
                                        className="!px-2 !py-1 text-xs font-semibold"
                                        disabled={pending || inputVal === ""}
                                        onClick={() => saveDelivery(o, inputVal)}
                                      >
                                        Zapisz
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          )}
        </section>

        <section id="informacja" className="scroll-mt-20 border-t border-slate-100">
          <SectionListLabel
            id="informacja"
            title="Pozycje informacyjne"
            hint="E-mail po dotarciu towaru — bez wpisywania ilości"
            count={informacjaOrders.length}
            icon={<IconAvailability size={17} />}
            tileClassName="bg-sky-100 text-sky-800"
          />
          <InformacjaQueueSection orders={informacjaOrders} embedded />
        </section>
          </>
        )}
      </Card>
    </div>
  );
}
