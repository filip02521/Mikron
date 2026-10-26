"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import type { IndividualOrder, SupplierWithSchedule } from "@/types/database";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { QueuePanelHelp } from "@/components/queue/QueuePanelHelp";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { Alert } from "@/components/ui/Alert";
import { QueuePanelToolbar, type QueueView } from "@/components/queue/QueuePanelToolbar";
import { AppBrandContentFooter } from "@/components/layout/AppBrandContentFooter";
import { brandLinkClass, panelWorkspaceShellClass } from "@/lib/ui/ontime-theme";
import { polishPluralWord } from "@/lib/email/polish-plural";
import { ReceiveQueueTable, type ReceiveQueueToast } from "@/components/queue/ReceiveQueueTable";
import { WarehouseInventorySection } from "@/components/queue/WarehouseInventorySection";
import type { WarehouseCarrierRow } from "@/lib/data/warehouse-carriers";
import { DeliveryJournalSection } from "@/components/queue/DeliveryJournalSection";
import type { WarehouseDeliveryReceipt } from "@/lib/warehouse/delivery-receipts-shared";
import { buildWarehouseInventoryRows } from "@/lib/orders/warehouse-inventory";
import { summarizeQueueInbox } from "@/lib/orders/queue-inbox";
import { mergeReceiveQueueOrders } from "@/lib/orders/receive-queue";
import { formatInformacjaAutoArrivedToast } from "@/lib/orders/informacja-flow-copy";
import { supplierKey } from "@/lib/orders/queue-supplier-groups";

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
  supplierSchedules = [],
  deliveryJournal,
  journalSuppliers,
  warehouseCarriers,
  canManageCarriers = false,
  canEditJournal = false,
  canClearFromShelf = false,
  showDailyPanelLink = false,
  showTeethLink = false,
  loadError = null,
  informacjaAutoArrivedCount = 0,
}: {
  orders: IndividualOrder[];
  informacjaOrders: IndividualOrder[];
  pickupReadyCount: number;
  warehouseInventory: IndividualOrder[];
  supplierSchedules?: SupplierWithSchedule[];
  deliveryJournal: {
    date: string;
    receipts: WarehouseDeliveryReceipt[];
    summary: { receiptCount: number; packageCount: number; palletCount: number };
    pendingBySupplier?: Record<string, number>;
  };
  journalSuppliers: Array<{ id: string; name: string; subiektKhId: number | null }>;
  warehouseCarriers: WarehouseCarrierRow[];
  canManageCarriers?: boolean;
  canEditJournal?: boolean;
  canClearFromShelf?: boolean;
  showDailyPanelLink?: boolean;
  showTeethLink?: boolean;
  loadError?: string | null;
  /** Liczba pozycji informacyjnych domkniętych auto-sync przy wejściu na stronę. */
  informacjaAutoArrivedCount?: number;
}) {
  const [view, setView] = useState<QueueView>("receive");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const autoArrivedToast = useMemo((): ReceiveQueueToast | null => {
    if (informacjaAutoArrivedCount <= 0) return null;
    const { title, text } = formatInformacjaAutoArrivedToast(informacjaAutoArrivedCount);
    return { title, text, tone: "success" };
  }, [informacjaAutoArrivedCount]);
  const [actionToast, setActionToast] = useState<ReceiveQueueToast | null>(null);
  const [autoToastDismissed, setAutoToastDismissed] = useState(false);
  const toast = actionToast ?? (autoToastDismissed ? null : autoArrivedToast);
  /** Fokus z badge „N oczekuje” — nonce wymusza re-aplikację przy tym samym dostawcy. */
  const [receiveFocus, setReceiveFocus] = useState<{
    supplierName: string | null;
    nonce: number;
  } | null>(null);

  const dismissToast = useCallback(() => {
    if (actionToast) {
      setActionToast(null);
      return;
    }
    setAutoToastDismissed(true);
  }, [actionToast]);

  const receiveQueue = useMemo(
    () => mergeReceiveQueueOrders(orders, informacjaOrders),
    [orders, informacjaOrders],
  );

  const inventoryCount = useMemo(
    () => buildWarehouseInventoryRows(warehouseInventory).length,
    [warehouseInventory],
  );

  const inboxSummary = useMemo(
    () => summarizeQueueInbox(orders, informacjaOrders),
    [orders, informacjaOrders],
  );

  useEffect(() => {
    const sync = () => {
      const hash = window.location.hash;
      if (hash === "#kolejka-zeby") {
        window.location.replace("/zeby/przyjecie");
        return;
      }
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

  const goToReceiveForSupplier = useCallback(
    (supplierName: string | null) => {
      let name =
        supplierName?.trim() && supplierName.trim() !== "-"
          ? supplierName.trim()
          : null;
      // Dopasuj klucz filtra 1:1 do chipów w kolejce (nazwa z relacji supplier).
      if (name) {
        const needle = name.toLowerCase();
        const match = receiveQueue.find(
          (o) => supplierKey(o).toLowerCase() === needle
        );
        if (match) name = supplierKey(match);
      }
      setReceiveFocus({ supplierName: name, nonce: Date.now() });
      setView("receive");
      const target = `${window.location.pathname}#kolejka-przyjecie`;
      if (
        `${window.location.pathname}${window.location.search}${window.location.hash}` !==
        target
      ) {
        window.history.replaceState(null, "", target);
      }
      requestAnimationFrame(() => {
        document.getElementById("kolejka-przyjecie")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    },
    [receiveQueue]
  );

  const partialCount = inboxSummary.partialCount;
  const cancelLabelled = inboxSummary.cancelLabelledCount;

  const crossLinks =
    showDailyPanelLink || showTeethLink ? (
      <>
        {showDailyPanelLink ? (
          <>
            Brak dostawcy uzupełnia zakupy w{" "}
            <Link href="/podsumowanie" className={brandLinkClass}>
              panelu dziennym
            </Link>
            .
          </>
        ) : null}
        {showDailyPanelLink && showTeethLink ? " " : null}
        {showTeethLink ? (
          <>
            Zęby przyjmujesz w{" "}
            <Link href="/zeby/przyjecie" className={brandLinkClass}>
              panelu zębów
            </Link>
            .
          </>
        ) : null}
      </>
    ) : null;

  return (
    <div className={panelWorkspaceShellClass}>
      {loadError ? (
        <Alert tone="error" className="mb-4">{loadError}</Alert>
      ) : null}
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <NoticeToast notice={toast} onDismiss={dismissToast} />
      ) : null}

      <PageHeader
        title="Przyjęcie towaru"
        help={<QueuePanelHelp links={crossLinks} />}
        className="mb-4"
      />

      <QueuePanelToolbar
        view={view}
        onViewChange={setQueueView}
        counts={{
          receive: inboxSummary.activeCount,
          journal: deliveryJournal.summary.receiptCount,
          inventory: inventoryCount,
        }}
        hints={{
          receive: receiveQueue.length
            ? [
                `${inboxSummary.zamowienieCount} ${polishPluralWord(inboxSummary.zamowienieCount, "zamówienie", "zamówienia", "zamówień")}`,
                inboxSummary.informacjaCount ? `${inboxSummary.informacjaCount} inf.` : null,
                pickupReadyCount ? `${pickupReadyCount} na regale` : null,
                partialCount ? `${partialCount} częściowo` : null,
                cancelLabelled ? `${cancelLabelled} z rezygnacją` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "nic nie czeka",
          journal: deliveryJournal.summary.receiptCount
            ? `${deliveryJournal.summary.receiptCount} ${polishPluralWord(deliveryJournal.summary.receiptCount, "dostawa", "dostawy", "dostaw")} dziś`
            : "brak wpisów dziś",
          inventory: inventoryCount ? "czeka na odbiór" : "regał pusty",
        }}
      />

      <div
        role="tabpanel"
        id="queue-panel-receive"
        aria-labelledby="queue-tab-receive"
        hidden={view !== "receive"}
      >
        <Card padding={false} className="overflow-hidden">
          <section id="kolejka-przyjecie" aria-label="Kolejka przyjęcia" className="scroll-mt-20">
            <ReceiveQueueTable
              deliveryOrders={orders}
              informacjaOrders={informacjaOrders}
              warehouseInventory={warehouseInventory}
              supplierSchedules={supplierSchedules}
              receiveFocus={receiveFocus}
              onToast={setActionToast}
              onPendingChange={setPendingMessage}
            />
          </section>
        </Card>
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
          canEditJournal={canEditJournal}
          canManageCarriers={canManageCarriers}
          onGoToReceive={goToReceiveForSupplier}
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
          canClearFromShelf={canClearFromShelf}
        />
      </div>

      <AppBrandContentFooter variant="page" className="mt-6" />
    </div>
  );
}
