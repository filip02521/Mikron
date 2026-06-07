"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { IndividualOrder } from "@/types/database";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionListLabel } from "@/components/ui/SectionListLabel";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconTruck, IconWarehouse } from "@/components/icons/StrokeIcons";
import { QueuePanelHelp } from "@/components/queue/QueuePanelHelp";
import { Toast } from "@/components/ui/Toast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Alert } from "@/components/ui/Alert";
import { QueuePanelToolbar } from "@/components/queue/QueuePanelToolbar";
import { panelPageShellClass } from "@/lib/ui/ontime-theme";
import { ReceiveQueueTable, type ReceiveQueueToast } from "@/components/queue/ReceiveQueueTable";
import { WarehouseInventorySection } from "@/components/queue/WarehouseInventorySection";
import { DeliveryJournalSection } from "@/components/queue/DeliveryJournalSection";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { buildWarehouseInventoryRows } from "@/lib/orders/warehouse-inventory";
import { summarizeQueueInbox } from "@/lib/orders/queue-inbox";
import { mergeReceiveQueueOrders } from "@/lib/orders/receive-queue";

type QueueView = "receive" | "journal" | "inventory";

export function QueueClient({
  orders,
  informacjaOrders,
  pickupReadyCount,
  warehouseInventory,
  deliveryJournal,
  journalSuppliers,
  isMagazynRole = false,
  loadError = null,
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
  loadError?: string | null;
}) {
  const [view, setView] = useState<QueueView>("receive");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ReceiveQueueToast | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const receiveQueue = useMemo(
    () => mergeReceiveQueueOrders(orders, informacjaOrders),
    [orders, informacjaOrders]
  );

  const inventoryCount = useMemo(
    () => buildWarehouseInventoryRows(warehouseInventory).length,
    [warehouseInventory]
  );

  const inboxSummary = useMemo(
    () => summarizeQueueInbox(orders, informacjaOrders),
    [orders, informacjaOrders]
  );

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      let next: QueueView = "receive";
      if (hash === "#inwentaryzacja") next = "inventory";
      else if (hash === "#dziennik-dostaw") next = "journal";
      else if (hash === "#informacja" || hash === "#dostawy-handlowcy") next = "receive";
      setView(next);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (view !== "receive") return;
    const hash = window.location.hash;
    if (hash !== "#informacja" && hash !== "#dostawy-handlowcy") return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("kolejka-przyjecie")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, receiveQueue.length]);

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

  const partialCount = inboxSummary.partialCount;
  const cancelLabelled = inboxSummary.cancelLabelledCount;

  const receiveHint = receiveQueue.length
    ? `${pickupReadyCount} na regale do odbioru · ${inboxSummary.zamowienieCount} zamówień · ${inboxSummary.informacjaCount} informacji · ${partialCount} częściowo${cancelLabelled ? ` · ${cancelLabelled} z rezygnacją` : ""}`
    : "Po zamówieniu u dostawcy w panelu dziennym";

  return (
    <div className={panelPageShellClass}>
      {loadError ? (
        <Alert tone="error">{loadError}</Alert>
      ) : null}
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}

      <Card padding={false} className="overflow-hidden">
        <CardHeader
          inset
          density="compact"
          leading={
            <SectionHeadingIcon tileClassName="bg-emerald-100 text-emerald-800">
              <IconWarehouse size={20} />
            </SectionHeadingIcon>
          }
          title="Magazyn i regał"
          description="Jedna lista przyjęcia: zamówienia i informacje u tego samego dostawcy."
          action={<QueuePanelHelp />}
        />

        <QueuePanelToolbar
          summary={inboxSummary}
          informacjaCount={inboxSummary.informacjaCount}
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
            deliveryQueueOrders={orders}
          />
        ) : (
          <section id="kolejka-przyjecie" className="scroll-mt-20">
            <SectionListLabel
              domain="panel"
              title="Kolejka przyjęcia"
              hint={receiveHint}
              count={receiveQueue.length}
              accent="emerald"
              icon={<IconTruck size={17} />}
              tileClassName="bg-emerald-100 text-emerald-800"
            />
            <ReceiveQueueTable
              deliveryOrders={orders}
              informacjaOrders={informacjaOrders}
              warehouseInventory={warehouseInventory}
              onToast={setToast}
              onPendingChange={setPendingMessage}
            />
          </section>
        )}
      </Card>
    </div>
  );
}
