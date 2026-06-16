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
import { QueuePanelToolbar, type QueueView } from "@/components/queue/QueuePanelToolbar";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { panelPageShellClass } from "@/lib/ui/ontime-theme";
import { ReceiveQueueTable, type ReceiveQueueToast } from "@/components/queue/ReceiveQueueTable";
import { WarehouseInventorySection } from "@/components/queue/WarehouseInventorySection";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import { DeliveryJournalSection } from "@/components/queue/DeliveryJournalSection";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts";
import { buildWarehouseInventoryRows } from "@/lib/orders/warehouse-inventory";
import { summarizeQueueInbox } from "@/lib/orders/queue-inbox";
import { mergeReceiveQueueOrders } from "@/lib/orders/receive-queue";

const RECEIVE_SCROLL_HASHES = new Set([
  "#kolejka-przyjecie",
  "#informacja",
  "#dostawy-handlowcy",
]);

function queueViewHash(view: QueueView): string {
  if (view === "inventory") return "#inwentaryzacja";
  if (view === "journal") return "#dziennik-dostaw";
  return "#kolejka-przyjecie";
}

export function QueueClient({
  orders,
  informacjaOrders,
  pickupReadyCount,
  warehouseInventory,
  deliveryJournal,
  journalSuppliers,
  warehouseCarriers,
  canManageCarriers = false,
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
  warehouseCarriers: WarehouseCarrierRow[];
  canManageCarriers?: boolean;
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
      if (hash === "#informacja" || hash === "#dostawy-handlowcy") {
        const canonical = `${window.location.pathname}${window.location.search}#kolejka-przyjecie`;
        window.history.replaceState(null, "", canonical);
      }
      const effectiveHash =
        hash === "#informacja" || hash === "#dostawy-handlowcy"
          ? "#kolejka-przyjecie"
          : hash;
      let next: QueueView = "receive";
      if (effectiveHash === "#inwentaryzacja") next = "inventory";
      else if (effectiveHash === "#dziennik-dostaw") next = "journal";
      else if (
        effectiveHash === "#kolejka-przyjecie" ||
        effectiveHash === "#informacja" ||
        effectiveHash === "#dostawy-handlowcy"
      ) {
        next = "receive";
      }
      setView(next);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (view !== "receive") return;
    const hash = window.location.hash;
    if (!RECEIVE_SCROLL_HASHES.has(hash)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById("kolejka-przyjecie")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [view, receiveQueue.length]);

  const setQueueView = useCallback((next: QueueView) => {
    setView(next);
    const hash = queueViewHash(next);
    const target = `${window.location.pathname}${window.location.search}${hash}`;
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
        <Toast
          message={toast.text}
          tone={toast.tone}
          durationMs={toast.durationMs}
          onDismiss={dismissToast}
        />
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
          title="Przyjęcie towaru"
          description="Jedna lista przyjęcia: zamówienia i informacje u tego samego dostawcy."
          action={<QueuePanelHelp />}
        />

        <QueuePanelToolbar
          view={view}
          onViewChange={setQueueView}
          summary={inboxSummary}
          pickupReadyCount={pickupReadyCount}
          inventoryCount={inventoryCount}
          journalCount={deliveryJournal.summary.receiptCount}
          showProcurementLinks={!isMagazynRole}
        />

        {/* Widoki pozostają zamontowane — filtry, zaznaczenia i formularze nie giną przy zmianie zakładki. */}
        <div
          role="tabpanel"
          id="queue-panel-receive"
          aria-labelledby="queue-tab-receive"
          hidden={view !== "receive"}
        >
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
        </div>

        <div
          role="tabpanel"
          id="queue-panel-journal"
          aria-labelledby="queue-tab-journal"
          hidden={view !== "journal"}
        >
          <DeliveryJournalSection
            suppliers={journalSuppliers}
            carriers={warehouseCarriers}
            initialJournal={deliveryJournal}
            todayDateKey={deliveryJournal.date}
            isMagazynRole={isMagazynRole}
            canManageCarriers={canManageCarriers}
          />
        </div>

        <div
          role="tabpanel"
          id="queue-panel-inventory"
          aria-labelledby="queue-tab-inventory"
          hidden={view !== "inventory"}
        >
          <WarehouseInventorySection
            orders={warehouseInventory}
            deliveryQueueOrders={orders}
          />
        </div>

        <AppBrandContentFooter />
      </Card>
    </div>
  );
}
