"use client";
import { WAREHOUSE_TOAST, receiveQueueDeliverySavedToast, receiveQueueSingleLineSavedToast, toastFromError, type ToastNotice, toastFromUnknown } from "@/lib/ui/notice-copy";
import { isUndoExpired, undoWindowBannerDescription } from "@/lib/orders/daily-panel-undo";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder, SupplierWithSchedule } from "@/types/database";
import type { DeliveryUndoPayload } from "@/lib/orders/receive-queue-undo-shared";
import { collectDeliveryNotificationQueueIds } from "@/lib/orders/receive-queue-undo-shared";
import {
  actionAcknowledgeWarehouseCancelDisposition,
  actionBatchUpdateDelivered,
  actionMarkInformacjaArrived,
  actionUndoDelivery,
  actionUpdateDelivered,
} from "@/app/actions/admin";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { UndoToast } from "@/components/ui/UndoToast";
import { NoticeToast } from "@/components/ui/NoticeToast";
import { QueueGroupExpandControl } from "@/components/queue/QueueGroupExpandControl";
import { ReceiveQueueSearchField } from "@/components/queue/ReceiveQueueSearchField";
import { ReceiveQueueActiveFilters } from "@/components/queue/ReceiveQueueActiveFilters";
import { ZdReceiveFilterModal } from "@/components/queue/ZdReceiveFilterModal";
import { IconCircleCheck, IconClipboardList } from "@/components/icons/StrokeIcons";
import { SupplierGroupHeaderRow } from "@/components/queue/SupplierGroupHeaderRow";
import { ReceiveQueueGroupMenu } from "@/components/queue/receive-queue/ReceiveQueueGroupMenu";
import { ReceiveQueueRow } from "@/components/queue/receive-queue/ReceiveQueueRow";
import { ReceiveQueueVirtualTbody } from "@/components/queue/receive-queue/ReceiveQueueVirtualTbody";
import { ReceiveQueueSelectionBar } from "@/components/queue/receive-queue/ReceiveQueueSelectionBar";
import { usePreviewMutationBlocker } from "@/components/layout/usePreviewMutationBlocker";
import { useReceiveQueueStockAlert } from "@/hooks/useReceiveQueueStockAlert";
import { useInformacjaQueueStockHint } from "@/hooks/useInformacjaQueueStockHint";
import { isSubiektVerifiedOrder } from "@/lib/orders/product-source";
import { INFORMACJA_AUTO_STOCK_QUEUE_HINT } from "@/lib/orders/informacja-flow-copy";
import { useUndoShortcutLabel } from "@/lib/platform/keyboard-shortcut-label";
import { useDeliveryNotificationFlush, cancelScheduledNotificationFlushes } from "@/lib/client/use-delivery-notification-flush";
import {
  getDeliveryProgress,
  isInformacjaRequest,
  parseOrderQuantity,
} from "@/lib/orders/individual";
import {
  receiveQueueTargetQuantity,
} from "@/lib/orders/sales-cancel";
import { warehouseCancelFulfillToast } from "@/lib/orders/warehouse-cancel-fulfillment";
import { brandLinkClass, checkboxBrandClass, panelTextLinkClass } from "@/lib/ui/ontime-theme";
import { MICROCOPY } from "@/lib/ui/microcopy";
import {
  QUEUE_LIST_BODY_CLASS,
  queueToolbarControlClass,
} from "@/lib/ui/queue-panel-styles";
import { InlineCheck } from "@/components/ui/UiGlyphs";
import { countOrdersBySupplier, filterOrdersBySupplier } from "@/lib/orders/supplier-filter-summary";
import {
  filterReceiveQueueTable,
  receiveQueueProductSearchEmptyTitle,
  receiveQueueSearchToolbarLabel,
} from "@/lib/orders/receive-queue-search";
import { searchQueryTokens } from "@/lib/orders/my-order-search";
import {
  countUnmatchedZdLines,
  type ZdReceiveFilterState,
  zdFilterToolbarLabel,
  zdFilterUnmatchedLinesLabel,
} from "@/lib/warehouse/zd-receive-filter";
import { cn } from "@/lib/cn";
import {
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
} from "@/lib/ui/ontime-theme";
import { HelpPopover } from "@/components/ui/HelpPopover";
import { polishPluralWord } from "@/lib/email/polish-plural";
import {
  informacjaProductKey,
  orderIdsInProductGroup,
} from "@/lib/orders/queue-product-groups";
import { buildSupplierGroupMetrics } from "@/lib/orders/supplier-group-metrics";
import { useSupplierGroupCollapse } from "@/lib/orders/use-supplier-group-collapse";
import { maxReceiveQueueWaitingDays, receiveQueueWaitingBusinessDays } from "@/lib/orders/receive-queue-waiting";
import { ReceiveSupplierFilterField } from "@/components/queue/ReceiveSupplierFilterField";
import {
  formatReceiveGroupHeaderSummary,
  groupReceiveQueueBySupplier,
  mergeReceiveQueueOrders,
  partitionReceiveSelection,
} from "@/lib/orders/receive-queue";
import { buildReceiveQueueVirtualItems } from "@/lib/orders/receive-queue-virtual-items";
import { RECEIVE_QUEUE_VIRTUAL_THRESHOLD } from "@/lib/ui/virtual-list-config";
import {
  batchDeliveryConfirmMessage,
  batchInformacjaConfirmMessage,
  batchNotifyButtonLabel,
  formatDeliveryBatchToast,
  formatInformacjaBatchToast,
  QUEUE_EMAIL_WARNING_TOAST_MS,
  requiresQueueBatchConfirm,
  selectedSaveButtonLabel,
} from "@/lib/orders/queue-batch-notify";
import { unwrapActionResult } from "@/lib/actions/action-error";

const COL_COUNT = 4;

export type ReceiveQueueToast = {
  title?: string;
  text?: string;
  tone: "success" | "error" | "warning";
  durationMs?: number;
};

type ReceiveQuickFilter = "all" | "stock" | "stale";

/** „Czeka ≥ 3 dni” — ten sam próg, od którego wiersz pokazuje czerwony znacznik. */
function isStaleReceiveOrder(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  return (receiveQueueWaitingBusinessDays(order) ?? 0) >= 3;
}

export function ReceiveQueueTable({
  deliveryOrders,
  informacjaOrders,
  warehouseInventory,
  supplierSchedules = [],
  receiveFocus = null,
  onToast,
  onPendingChange,
}: {
  deliveryOrders: IndividualOrder[];
  informacjaOrders: IndividualOrder[];
  warehouseInventory: IndividualOrder[];
  supplierSchedules?: SupplierWithSchedule[];
  /** Fokus z dziennika (badge „oczekuje”) — nonce wymusza ponowne ustawienie filtra. */
  receiveFocus?: { supplierName: string | null; nonce: number } | null;
  onToast: (toast: ReceiveQueueToast) => void;
  onPendingChange: (message: string | null) => void;
}) {
  const router = useRouter();
  const { blockIfReadOnly } = usePreviewMutationBlocker((text) =>
    onToast(toastFromError(text))
  );
  const [pending, start] = useTransition();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [supplierFilter, setSupplierFilter] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productSearchResetToken, setProductSearchResetToken] = useState(0);
  const [zdFilter, setZdFilter] = useState<ZdReceiveFilterState | null>(null);
  const [zdModalOpen, setZdModalOpen] = useState(false);
  const supplierBeforeZdRef = useRef<string | undefined>(undefined);
  const [batchSaveConfirm, setBatchSaveConfirm] = useState<{
    orderIds: string[];
    fullQuantity?: boolean;
  } | null>(null);
  const [notifyConfirmIds, setNotifyConfirmIds] = useState<string[] | null>(null);
  const [undo, setUndo] = useState<DeliveryUndoPayload | null>(null);
  const [undoError, setUndoError] = useState<ToastNotice | null>(null);

  const clearUndo = useCallback(() => {
    setUndo(null);
    setUndoError(null);
  }, []);

  const undoShortcut = useUndoShortcutLabel();
  useDeliveryNotificationFlush(undo);

  const handleUndo = useCallback(() => {
    if (!undo) return;
    setUndoError(null);
    if (isUndoExpired(undo.expiresAt)) {
      setUndoError(WAREHOUSE_TOAST.undoReceiveExpired);
      return;
    }
    start(async () => {
      try {
        onPendingChange("Cofanie przyjęcia towaru…");
        cancelScheduledNotificationFlushes(
          collectDeliveryNotificationQueueIds(undo.token.snapshots)
        );
        await actionUndoDelivery(undo);
        clearUndo();
        router.refresh();
        onToast(WAREHOUSE_TOAST.undoReceiveSuccess);
      } catch (e) {
        setUndoError(
          toastFromUnknown(e, WAREHOUSE_TOAST.undoReceiveFailed.text
          )
        );
      } finally {
        onPendingChange(null);
      }
    });
  }, [undo, clearUndo, onPendingChange, onToast, router]);

  useEffect(() => {
    if (!undo) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      handleUndo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, handleUndo]);

  const receiveQueue = useMemo(
    () => mergeReceiveQueueOrders(deliveryOrders, informacjaOrders),
    [deliveryOrders, informacjaOrders]
  );

  const [quickFilter, setQuickFilter] = useState<ReceiveQuickFilter>("all");
  const stockAvailableOnly = quickFilter === "stock";

  const { stockByTwId, availableTwIds, availableCount, loading: stockAlertLoading } =
    useReceiveQueueStockAlert(deliveryOrders, true);

  const { availableTwIds: informacjaAvailableTwIds } = useInformacjaQueueStockHint(
    informacjaOrders,
    true
  );

  const showInformacjaAutoHint = useMemo(
    () => informacjaOrders.some((o) => isSubiektVerifiedOrder(o) && !o.is_teeth),
    [informacjaOrders]
  );

  const handleStockBadgeClick = useCallback((orderId: string) => {
    const order = deliveryOrders.find((o) => o.id === orderId);
    if (!order) return;
    const twId = order.subiekt_tw_id;
    if (twId == null || twId <= 0) return;
    const snap = stockByTwId[Math.trunc(twId)];
    if (!snap) return;
    const ordered = receiveQueueTargetQuantity(order) ?? parseOrderQuantity(order.quantity);
    const fillQty = ordered != null ? Math.min(snap.available, ordered) : snap.available;
    setQty((s) => ({ ...s, [orderId]: String(fillQty) }));
  }, [deliveryOrders, stockByTwId]);

  const { filtered, supplierFiltered, zdScoped, baseQueue } = useMemo(() => {
    const baseQueue = stockAvailableOnly
      ? receiveQueue.filter((o) => {
          if (isInformacjaRequest(o)) return false;
          const twId = o.subiekt_tw_id;
          return twId != null && twId > 0 && availableTwIds.has(Math.trunc(twId));
        })
      : quickFilter === "stale"
        ? receiveQueue.filter(isStaleReceiveOrder)
        : receiveQueue;
    const supplierFiltered = filterOrdersBySupplier(baseQueue, supplierFilter);
    const zdScoped = filterReceiveQueueTable(baseQueue, {
      supplierFilter,
      zdProfile: zdFilter?.profile ?? null,
      productSearch: "",
    });
    const filtered =
      productSearch.trim().length > 0
        ? filterReceiveQueueTable(baseQueue, {
            supplierFilter,
            zdProfile: zdFilter?.profile ?? null,
            productSearch,
          })
        : zdScoped;
    return { filtered, supplierFiltered, zdScoped, baseQueue };
  }, [receiveQueue, supplierFilter, zdFilter, productSearch, stockAvailableOnly, quickFilter, availableTwIds]);

  const staleCount = useMemo(() => receiveQueue.filter(isStaleReceiveOrder).length, [receiveQueue]);

  const productSearchActive = searchQueryTokens(productSearch).length > 0;
  const hasActiveFilters = productSearchActive || Boolean(zdFilter);

  const zdUnmatchedLineCount = useMemo(() => {
    if (!zdFilter) return 0;
    return countUnmatchedZdLines(zdFilter.profile, supplierFiltered);
  }, [supplierFiltered, zdFilter]);

  // Liczniki dostawców po szybkim filtrze — „DREVE 2” w liście ma znaczyć 2 pozycje na ekranie.
  const supplierChips = useMemo(() => countOrdersBySupplier(baseQueue), [baseQueue]);
  const supplierGroups = useMemo(
    () => groupReceiveQueueBySupplier(filtered),
    [filtered],
  );
  const supplierMetrics = useMemo(
    () => buildSupplierGroupMetrics(deliveryOrders, warehouseInventory),
    [deliveryOrders, warehouseInventory]
  );
  const supplierScheduleMap = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const s of supplierSchedules) {
      const name = s.name?.trim();
      if (!name) continue;
      map.set(name, s.schedule?.computed_next_date ?? null);
    }
    return map;
  }, [supplierSchedules]);
  const collapse = useSupplierGroupCollapse(supplierGroups, supplierFilter, {
    collapseMode: "all",
  });

  const supplierGroupsSignature = useMemo(
    () => supplierGroups.map((g) => g.supplierKey).join("\0"),
    [supplierGroups]
  );
  const queueTableRef = useRef<HTMLTableElement>(null);
  const queueVirtualItems = useMemo(
    () => buildReceiveQueueVirtualItems(supplierGroups, collapse.isExpanded),
    [supplierGroups, collapse]
  );
  const queueVirtualEnabled =
    queueVirtualItems.length >= RECEIVE_QUEUE_VIRTUAL_THRESHOLD;

  useEffect(() => {
    if (!productSearchActive) return;
    collapse.expandAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- expand when search results set changes
  }, [productSearchActive, supplierGroupsSignature]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const supplierParam = params.get("supplier")?.trim();
    if (!supplierParam) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSupplierFilter(supplierParam);
      // Zdejmij tylko ?supplier= — zostaw #kolejka-przyjecie (router.replace("/kolejka") kasował hash).
      const url = new URL(window.location.href);
      url.searchParams.delete("supplier");
      const cleaned = `${url.pathname}${url.search}${url.hash || "#kolejka-przyjecie"}`;
      window.history.replaceState(null, "", cleaned);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!receiveFocus) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const name = receiveFocus.supplierName?.trim();
      if (name && name !== "-") {
        setSupplierFilter(name);
          setZdFilter(null);
      } else {
        setSupplierFilter("");
        }
    });
    return () => {
      cancelled = true;
    };
  }, [receiveFocus]);

  const selectedIds = useMemo(
    () => filtered.filter((o) => selected[o.id]).map((o) => o.id),
    [filtered, selected]
  );

  const selectionParts = useMemo(
    () => partitionReceiveSelection(filtered, selectedIds),
    [filtered, selectedIds]
  );

  const getQty = useCallback((o: IndividualOrder) => {
    if (qty[o.id] !== undefined) return qty[o.id];
    const d = o.delivered_quantity;
    if (d && d !== "-") return d;
    const target = receiveQueueTargetQuantity(o);
    if (target != null && target > 0) return String(target);
    const ordered = parseOrderQuantity(o.quantity);
    if (ordered != null && ordered > 0) return String(ordered);
    return "";
  }, [qty]);

  const selectedZamowienieWithQty = useMemo(
    () => selectionParts.zamowienie.filter((o) => getQty(o).trim() !== ""),
    [selectionParts.zamowienie, getQty]
  );

  const deliveryProgressForOrder = (order: IndividualOrder, value: string) => {
    const target = receiveQueueTargetQuantity(order);
    return getDeliveryProgress(
      target != null ? String(target) : order.quantity,
      value
    );
  };

  const clearZdFilter = useCallback(() => {
    setZdFilter((current) => {
      if (current && supplierBeforeZdRef.current !== undefined) {
        setSupplierFilter((supplier) =>
          supplier === current.supplierName
            ? supplierBeforeZdRef.current!
            : supplier
        );
      }
      supplierBeforeZdRef.current = undefined;
      return null;
    });
  }, []);
  const clearProductSearch = useCallback(() => {
    setProductSearch("");
    setProductSearchResetToken((token) => token + 1);
  }, []);

  const applyZdFilter = useCallback(
    (next: ZdReceiveFilterState) => {
      const ordersForSupplier = receiveQueue.filter((o) => o.supplier_id === next.supplierId);
      const supplierName =
        ordersForSupplier[0]?.supplier?.name?.trim() ||
        receiveQueue.find((o) => (o.supplier?.name?.trim() || "-") === next.supplierName)
          ?.supplier?.name?.trim() ||
        next.supplierName;
      setZdFilter({ ...next, supplierName });
      setSupplierFilter((current) => {
        if (supplierBeforeZdRef.current === undefined) {
          supplierBeforeZdRef.current = current;
        }
        return supplierName;
      });
      setSelected({});
    },
    [receiveQueue]
  );

  const subiektOfflineToast = useCallback(
    () =>
      onToast({
        ...WAREHOUSE_TOAST.subiektOffline,
        durationMs: QUEUE_EMAIL_WARNING_TOAST_MS,
      }),
    [onToast]
  );

  const selectAllZdMatches = useCallback(() => {
    if (!zdFilter) return;
    setSelected((current) => {
      const next = { ...current };
      for (const order of filtered) next[order.id] = true;
      return next;
    });
  }, [filtered, zdFilter]);

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

  const toggleProductGroup = (list: IndividualOrder[], startIndex: number, checked: boolean) => {
    const ids = orderIdsInProductGroup(list, startIndex);
    setSelected((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = checked;
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? Object.fromEntries(filtered.map((o) => [o.id, true])) : {});
  };

  const clearSelection = () => setSelected({});

  const saveDelivery = (order: IndividualOrder, value: string) => {
    if (blockIfReadOnly()) return;
    onPendingChange("Zapisywanie dostawy…");
    start(async () => {
      try {
        const result = await unwrapActionResult(actionUpdateDelivered(order.id, value));
        setQty((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        setSelected((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        if (result.undo) {
          setUndoError(null);
          setUndo(result.undo);
        }
        const progress = deliveryProgressForOrder(order, value);
        const person = order.sales_person?.name ?? "handlowiec";

        const savedToast = receiveQueueDeliverySavedToast({
          person,
          emailQueued: Boolean(result.emailQueued),
          emailError: result.emailError,
          fulfilled: progress.remaining != null && progress.remaining === 0 && progress.hasNumericQty,
          fractionLabel:
            progress.delivered > 0 && progress.hasNumericQty && progress.remaining != null && progress.remaining > 0
              ? progress.fractionLabel
              : undefined,
          remaining:
            progress.delivered > 0 && progress.hasNumericQty && progress.remaining != null && progress.remaining > 0
              ? progress.remaining
              : undefined,
        });
        onToast({
          ...savedToast,
          durationMs: result.emailError ? QUEUE_EMAIL_WARNING_TOAST_MS : undefined,
        });
        router.refresh();
      } catch (e) {
        onToast(toastFromUnknown(e, "Nie udało się zapisać"));
      } finally {
        onPendingChange(null);
      }
    });
  };

  const ackCancelDisposition = (order: IndividualOrder) => {
    if (blockIfReadOnly()) return;
    onPendingChange("Rozliczanie rezygnacji…");
    start(async () => {
      try {
        const result = await actionAcknowledgeWarehouseCancelDisposition([order.id]);
        setSelected((s) => {
          const next = { ...s };
          delete next[order.id];
          return next;
        });
        onToast({
          text:
            result.count > 0
              ? warehouseCancelFulfillToast(order)
              : WAREHOUSE_TOAST.cancelDispositionDone.text,
          title:
            result.count > 0 ? "Rozliczono" : WAREHOUSE_TOAST.cancelDispositionDone.title,
          tone: "success",
        });
        router.refresh();
      } catch (e) {
        onToast(
          toastFromUnknown(e, WAREHOUSE_TOAST.cancelDispositionFailed.text
          )
        );
      } finally {
        onPendingChange(null);
      }
    });
  };

  const saveBatch = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    if (blockIfReadOnly()) return;
    const updates = orderIds
      .map((id) => {
        const order = receiveQueue.find((o) => o.id === id);
        if (!order || isInformacjaRequest(order)) return null;
        const ordered = receiveQueueTargetQuantity(order);
        let value = "";
        if (opts?.fullQuantity && ordered != null) {
          value = String(ordered);
        } else {
          value = getQty(order);
        }
        if (!value.trim()) return null;
        return { orderId: id, qty: value };
      })
      .filter((u): u is { orderId: string; qty: string } => u != null);

    const skippedQty = orderIds.length - updates.length;

    if (!updates.length) {
      onToast(WAREHOUSE_TOAST.batchNoQuantity);
      return;
    }

    onPendingChange(updates.length > 1 ? "Zbiorczy zapis dostaw…" : "Zapisywanie dostawy…");
    start(async () => {
      try {
        if (updates.length === 1 && orderIds.length === 1) {
          const only = updates[0]!;
          const result = await unwrapActionResult(actionUpdateDelivered(only.orderId, only.qty));
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
          if (result.undo) {
            setUndoError(null);
            setUndo(result.undo);
          }
          const order = receiveQueue.find((o) => o.id === only.orderId);
          const person = order?.sales_person?.name ?? "handlowiec";
          const lineToast = receiveQueueSingleLineSavedToast({
            person,
            emailQueued: Boolean(result.emailQueued),
            emailError: result.emailError,
          });
          onToast({
            ...lineToast,
            durationMs: result.emailError ? QUEUE_EMAIL_WARNING_TOAST_MS : undefined,
          });
        } else {
          const result = await actionBatchUpdateDelivered(updates);
          if ("error" in result) {
            onToast(toastFromError(result.error));
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
          if (result.undo) {
            setUndoError(null);
            setUndo(result.undo);
          }
          const toast = formatDeliveryBatchToast(result);
          if (skippedQty > 0) {
            toast.text += ` · ${skippedQty} bez ilości (pominięto)`;
            toast.tone = "error";
          }
          onToast(toast);
        }
        router.refresh();
      } catch (e) {
        onToast(
          toastFromUnknown(e, WAREHOUSE_TOAST.deliverySaveFailed.text
          )
        );
      } finally {
        onPendingChange(null);
      }
    });
  };

  const requestSaveBatch = (orderIds: string[], opts?: { fullQuantity?: boolean }) => {
    if (requiresQueueBatchConfirm(orderIds) || opts?.fullQuantity) {
      setBatchSaveConfirm({ orderIds, fullQuantity: opts?.fullQuantity });
      return;
    }
    saveBatch(orderIds, opts);
  };

  const markInformacja = (orderIds: string[]) => {
    if (blockIfReadOnly()) return;
    onPendingChange(
      orderIds.length > 1 ? "Wysyłanie powiadomień…" : "Powiadamianie handlowca…"
    );
    start(async () => {
      try {
        const r = await actionMarkInformacjaArrived(orderIds);
        if ("error" in r) {
          onToast(toastFromError(r.error));
          return;
        }
        setSelected((s) => {
          const next = { ...s };
          for (const id of orderIds) delete next[id];
          return next;
        });
        onToast(formatInformacjaBatchToast(r));
        router.refresh();
      } catch (e) {
        onToast(
          toastFromUnknown(e, WAREHOUSE_TOAST.deliverySaveFailed.text
          )
        );
      } finally {
        onPendingChange(null);
      }
    });
  };

  const requestMarkInformacja = (orderIds: string[]) => {
    if (requiresQueueBatchConfirm(orderIds)) {
      setNotifyConfirmIds(orderIds);
      return;
    }
    markInformacja(orderIds);
  };

  const zamowienieIdsInGroup = (groupOrders: IndividualOrder[]) =>
    groupOrders.filter((o) => !isInformacjaRequest(o)).map((o) => o.id);

  const informacjaIdsInGroup = (groupOrders: IndividualOrder[]) =>
    groupOrders.filter(isInformacjaRequest).map((o) => o.id);

  const allSelected = filtered.length > 0 && filtered.every((o) => selected[o.id]);

  const zdModal = (
    <ZdReceiveFilterModal
      open={zdModalOpen}
      onClose={() => setZdModalOpen(false)}
      receiveQueue={receiveQueue}
      onApply={applyZdFilter}
      onError={(message) => onToast(toastFromError(message))}
      onSubiektOffline={subiektOfflineToast}
    />
  );

  const quickFilters: { id: ReceiveQuickFilter; label: string; count: number; tone?: "ok" }[] = [
    { id: "all", label: "Wszystko", count: receiveQueue.length },
    ...(availableCount > 0 && !stockAlertLoading
      ? [{ id: "stock" as const, label: "Na stanie Subiekta", count: availableCount, tone: "ok" as const }]
      : []),
    ...(staleCount > 0 ? [{ id: "stale" as const, label: "Czeka ≥ 3 dni", count: staleCount }] : []),
  ];

  const toolbar = (
    <div className="space-y-3 border-b border-slate-100 px-3 py-3 sm:px-4 lg:px-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <ReceiveQueueSearchField
          key={`receive-product-search-${productSearchResetToken}`}
          onDebouncedChange={setProductSearch}
          className="min-w-0 md:flex-1"
        />
        <div className="flex min-w-0 gap-2">
          <ReceiveSupplierFilterField
            chips={supplierChips}
            value={supplierFilter}
            onChange={(next) => {
              setSupplierFilter(next);
              if (zdFilter && next !== zdFilter.supplierName) {
                setZdFilter(null);
              }
            }}
            className="min-w-0 flex-1 md:w-64 md:flex-none"
          />
          <button
            type="button"
            onClick={() => setZdModalOpen(true)}
            aria-pressed={Boolean(zdFilter)}
            className={cn(
              panelChoiceChipClass,
              queueToolbarControlClass,
              zdFilter ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
              "inline-flex shrink-0 items-center justify-center gap-2 px-3 text-sm",
            )}
          >
            <IconClipboardList size={16} className="shrink-0" aria-hidden />
            {zdFilter ? `ZD ${zdFilter.docNumber}` : "Szukaj ZD"}
          </button>
        </div>
      </div>

      {hasActiveFilters ? (
        <div className="space-y-1">
          <ReceiveQueueActiveFilters
            productSearch={productSearch}
            onClearProductSearch={clearProductSearch}
            zdFilter={zdFilter}
            onClearZdFilter={clearZdFilter}
          />
          {productSearchActive ? (
            <p className="text-[0.6875rem] font-medium text-slate-700">
              {receiveQueueSearchToolbarLabel(filtered.length, zdScoped.length, productSearch)}
            </p>
          ) : null}
          {zdFilter ? (
            <>
              <p className="text-[0.6875rem] font-medium text-slate-700">
                {zdFilterToolbarLabel(filtered.length, supplierFiltered.length)}
              </p>
              {zdFilterUnmatchedLinesLabel(zdUnmatchedLineCount) ? (
                <p className="text-[0.6875rem] text-amber-800">
                  {zdFilterUnmatchedLinesLabel(zdUnmatchedLineCount)}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* Szybkie filtry z licznikami (jedno wybrane); instrukcja pod „Jak przyjmować”. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          role="group"
          aria-label="Szybki filtr"
          className="-mx-3 flex min-w-0 max-w-[calc(100%+1.5rem)] gap-1.5 overflow-x-auto px-3 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:max-w-none sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {quickFilters.map((f) => {
            const active = quickFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setQuickFilter(f.id)}
                className={cn(
                  panelChoiceChipClass,
                  active ? panelChoiceChipSelectedClass : panelChoiceChipIdleClass,
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[0.8125rem] sm:min-h-8",
                )}
              >
                {f.tone === "ok" ? <IconCircleCheck size={14} className="shrink-0 text-emerald-600" aria-hidden /> : null}
                {f.label}
                <span className="tabular-nums text-slate-500">{f.count}</span>
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <p className="text-[0.8125rem] tabular-nums text-slate-500" aria-live="polite">
            {filtered.length} {polishPluralWord(filtered.length, "pozycja", "pozycje", "pozycji")}
          </p>
          {zdFilter && filtered.length > 0 ? (
            <button
              type="button"
              onClick={selectAllZdMatches}
              className={cn(brandLinkClass, "inline-flex min-h-11 items-center text-xs sm:min-h-8")}
            >
              Zaznacz wszystkie pasujące
            </button>
          ) : null}
          <HelpPopover
            label="Jak przyjmować towar"
            title="Jak przyjmować"
            shortLabel="Jak przyjmować"
            align="right"
            buttonClassName={cn(
              panelTextLinkClass,
              "inline-flex min-h-11 shrink-0 items-center gap-1 border-0 bg-transparent px-0 text-[0.8125rem] font-medium shadow-none hover:underline sm:min-h-0",
            )}
          >
            <ul className="space-y-2 text-sm leading-relaxed text-slate-700">
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>
                  Zamówienie: wpisz ilość i naciśnij Enter albo <InlineCheck size={11} className="inline align-[-2px]" />.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                <span>Informacja: przycisk powiadomienia albo zaznacz kilka i powiadom razem.</span>
              </li>
              {showInformacjaAutoHint ? <li className="text-slate-600">{INFORMACJA_AUTO_STOCK_QUEUE_HINT}</li> : null}
            </ul>
          </HelpPopover>
          <QueueGroupExpandControl
            groupCount={supplierGroups.length}
            allExpanded={collapse.allExpanded}
            onExpandAll={collapse.expandAll}
            onCollapseAll={collapse.collapseAll}
            className="text-[0.8125rem] sm:text-[0.8125rem]"
          />
        </div>
      </div>
    </div>
  );

  if (!receiveQueue.length) {
    return (
      <EmptyState
        title={MICROCOPY.empty.queue.title}
        description={MICROCOPY.empty.queue.description}
      />
    );
  }

  const emptyFilteredTitle = productSearchActive
    ? receiveQueueProductSearchEmptyTitle(productSearch)
    : zdFilter
      ? "Brak pozycji pasujących do ZD"
      : MICROCOPY.empty.queue.filterTitle;

  const emptyFilteredDescription = productSearchActive
    ? "Spróbuj innego symbolu, nazwy lub kodu Mikron - albo wyczyść wyszukiwanie."
    : zdFilter
      ? `Żadna pozycja w kolejce nie pasuje do ${zdFilter.docNumber}. Sprawdź inny dokument lub wyczyść filtr ZD.`
      : MICROCOPY.empty.queue.filterDescription;

  return (
    <>
      {zdModal}
      <ConfirmDialog
        open={batchSaveConfirm != null}
        tier={zdModalOpen ? "stack" : "raised"}
        title={
          batchSaveConfirm?.fullQuantity
            ? "Zapisać całą dostawę grupy?"
            : "Zapisać zaznaczone zamówienia?"
        }
        message={
          batchSaveConfirm
            ? batchDeliveryConfirmMessage(receiveQueue, batchSaveConfirm.orderIds, {
                fullQuantity: batchSaveConfirm.fullQuantity,
              })
            : ""
        }
        confirmLabel={
          batchSaveConfirm
            ? batchSaveConfirm.fullQuantity
              ? batchNotifyButtonLabel(receiveQueue, batchSaveConfirm.orderIds, {
                  prefix: "Całość",
                })
              : selectedSaveButtonLabel(batchSaveConfirm.orderIds.length)
            : "Zapisz"
        }
        pending={pending}
        onCancel={() => setBatchSaveConfirm(null)}
        onConfirm={() => {
          if (!batchSaveConfirm) return;
          const { orderIds, fullQuantity } = batchSaveConfirm;
          setBatchSaveConfirm(null);
          saveBatch(orderIds, fullQuantity ? { fullQuantity: true } : undefined);
        }}
      />

      {undo ? (
        <UndoToast
          title="Przyjęto towar"
          description={undoWindowBannerDescription(
            "Cofnięcie przywraca stan magazynu i anuluje zaplanowany e-mail do handlowca"
          )}
          placement="floating"
          expiresAt={undo.expiresAt}
          onDismiss={clearUndo}
          onUndo={() => void handleUndo()}
          undoLabel="Cofnij przyjęcie"
          undoShortcut={undoShortcut}
        />
      ) : null}
      {undoError ? (
        <NoticeToast
          notice={undoError}
          stacked={Boolean(undo)}
          onDismiss={() => setUndoError(null)}
        />
      ) : null}

      <ConfirmDialog
        open={notifyConfirmIds != null}
        tier={zdModalOpen ? "stack" : "raised"}
        title="Wysłać powiadomienia informacyjne?"
        message={
          notifyConfirmIds
            ? batchInformacjaConfirmMessage(receiveQueue, notifyConfirmIds)
            : ""
        }
        confirmLabel={
          notifyConfirmIds
            ? `Wyślij powiadomienia (${notifyConfirmIds.length})`
            : "Wyślij"
        }
        pending={pending}
        onCancel={() => setNotifyConfirmIds(null)}
        onConfirm={() => {
          if (!notifyConfirmIds) return;
          const ids = notifyConfirmIds;
          setNotifyConfirmIds(null);
          markInformacja(ids);
        }}
      />

      {toolbar}

      {!filtered.length ? (
        <EmptyState title={emptyFilteredTitle} description={emptyFilteredDescription} />
      ) : (
        <>
          <ReceiveQueueSelectionBar
            zamowienie={selectionParts.zamowienie}
            informacja={selectionParts.informacja}
            canSaveZamowienie={selectedZamowienieWithQty.length > 0}
            pending={pending}
            onSaveZamowienie={() =>
              requestSaveBatch(selectionParts.zamowienie.map((o) => o.id))
            }
            onNotifyInformacja={() =>
              requestMarkInformacja(selectionParts.informacja.map((o) => o.id))
            }
            onClear={clearSelection}
          />

          <TableScroll className="px-0 pb-0 sm:px-0 sm:pb-0">
        {/* Lista rośnie z całą stroną; własne przewijanie tylko przy wirtualizacji (RECEIVE_QUEUE_VIRTUAL_THRESHOLD). */}
        <div className={queueVirtualEnabled ? QUEUE_LIST_BODY_CLASS : undefined}>
          <DataTable
            ref={queueTableRef}
            className="queue-table receive-queue-table"
          >
            <thead
              className={cn(
                "sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm",
                queueVirtualEnabled && "shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
              )}
            >
              <tr className="border-b border-slate-200/80">
              <th className="w-9 bg-slate-50/95 px-2 py-2.5">
                <input
                  type="checkbox"
                  className={cn("size-4", checkboxBrandClass)}
                  checked={allSelected}
                  disabled={pending}
                  aria-label="Zaznacz wszystkie pozycje"
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="bg-slate-50/95 px-2 py-2.5 text-left text-[0.8125rem] font-medium text-slate-500">Dostawca · handlowiec</th>
              <th className="bg-slate-50/95 px-2 py-2.5 text-left text-[0.8125rem] font-medium text-slate-500">Produkt</th>
              <th className="w-[9.5rem] bg-slate-50/95 px-2 py-2.5 text-right text-[0.8125rem] font-medium text-slate-500">Realizacja</th>
            </tr>
          </thead>
          <ReceiveQueueVirtualTbody
            tableRef={queueTableRef}
            supplierGroups={supplierGroups}
            supplierMetrics={supplierMetrics}
            collapse={collapse}
            selected={selected}
            pending={pending}
            productSearchActive={productSearchActive}
            productSearch={productSearch}
            receiveQueue={receiveQueue}
            supplierScheduleMap={supplierScheduleMap}
            getQty={getQty}
            zamowienieIdsInGroup={zamowienieIdsInGroup}
            informacjaIdsInGroup={informacjaIdsInGroup}
            toggleSupplierGroupIds={toggleSupplierGroupIds}
            requestSaveBatch={requestSaveBatch}
            requestMarkInformacja={requestMarkInformacja}
            toggleSelected={toggleSelected}
            setQty={setQty}
            saveDelivery={saveDelivery}
            toggleProductGroup={toggleProductGroup}
            ackCancelDisposition={ackCancelDisposition}
            stockByTwId={stockByTwId}
            informacjaAvailableTwIds={informacjaAvailableTwIds}
            onStockBadgeClick={handleStockBadgeClick}
            renderClassic={() =>
              supplierGroups.map((group, groupIndex) => {
                const groupIds = group.orders.map((o) => o.id);
                const groupAllSelected =
                  groupIds.length > 0 && groupIds.every((id) => selected[id]);
                const isOpen = collapse.isExpanded(group.supplierKey);
                const summary = formatReceiveGroupHeaderSummary(
                  group.orders,
                  supplierMetrics.get(group.supplierKey)
                );
                const zamIds = zamowienieIdsInGroup(group.orders);
                const infoIds = informacjaIdsInGroup(group.orders);

                return (
                  <Fragment key={`receive-group-${groupIndex}`}>
                    <SupplierGroupHeaderRow
                      colSpan={COL_COUNT}
                      groupIndex={groupIndex}
                      group={group}
                      summary={summary}
                      isOpen={isOpen}
                      onToggle={() => collapse.toggle(group.supplierKey)}
                      variant="delivery"
                      scheduleDate={supplierScheduleMap.get(group.supplierKey) ?? null}
                      maxWaitingDays={maxReceiveQueueWaitingDays(group.orders)}
                      actions={
                        <ReceiveQueueGroupMenu
                          groupIds={groupIds}
                          groupAllSelected={groupAllSelected}
                          zamIds={zamIds}
                          infoIds={infoIds}
                          receiveQueue={receiveQueue}
                          pending={pending}
                          onToggleSelectAll={(checked) =>
                            toggleSupplierGroupIds(groupIds, checked)
                          }
                          onSaveFullZamowienie={() =>
                            requestSaveBatch(zamIds, { fullQuantity: true })
                          }
                          onNotifyInformacja={() => requestMarkInformacja(infoIds)}
                        />
                      }
                    />
                    {isOpen
                      ? group.orders.map((o, rowIndex) => {
                          const isInfo = isInformacjaRequest(o);
                          const prevKey =
                            rowIndex > 0
                              ? informacjaProductKey(group.orders[rowIndex - 1]!)
                              : null;
                          const isFirstInProductGroup =
                            informacjaProductKey(o) !== prevKey;
                          const productGroupIds =
                            isInfo && isFirstInProductGroup
                              ? orderIdsInProductGroup(group.orders, rowIndex).filter(
                                  (id) =>
                                    group.orders.find(
                                      (x) => x.id === id && isInformacjaRequest(x)
                                    )
                                )
                              : [];
                          const productGroupAllSelected =
                            productGroupIds.length > 0 &&
                            productGroupIds.every((id) => selected[id]);
                          const ordered = receiveQueueTargetQuantity(o);
                          const inputVal = getQty(o);
                          const twId = o.subiekt_tw_id;
                          const stockAvailable = twId != null && twId > 0 && stockByTwId
                            ? stockByTwId[Math.trunc(twId)]?.available ?? null
                            : null;
                          const informacjaStockHint = !isInfo
                            ? null
                            : o.is_teeth
                              ? "teeth"
                              : !isSubiektVerifiedOrder(o)
                                ? "manual_only"
                                : twId != null &&
                                    twId > 0 &&
                                    informacjaAvailableTwIds.has(Math.trunc(twId))
                                  ? "auto_ready"
                                  : null;

                          return (
                            <ReceiveQueueRow
                              key={o.id}
                              order={o}
                              groupIndex={groupIndex}
                              rowIndex={rowIndex}
                              isInfo={isInfo}
                              isFirstInProductGroup={isFirstInProductGroup}
                              productGroupIds={productGroupIds}
                              productGroupAllSelected={productGroupAllSelected}
                              selected={!!selected[o.id]}
                              pending={pending}
                              inputVal={inputVal}
                              stockAvailable={stockAvailable}
                              informacjaStockHint={informacjaStockHint}
                              searchQuery={productSearchActive ? productSearch : null}
                              onToggleSelected={() => toggleSelected(o.id)}
                              onQtyChange={(value) =>
                                setQty((s) => ({ ...s, [o.id]: value }))
                              }
                              onSaveDelivery={() => saveDelivery(o, inputVal)}
                              onFillFullQty={() => {
                                if (ordered == null) return;
                                saveDelivery(o, String(ordered));
                              }}
                              onNotifyInformacja={requestMarkInformacja}
                              onToggleProductGroup={(checked) =>
                                toggleProductGroup(group.orders, rowIndex, checked)
                              }
                              onAckCancelDisposition={() => ackCancelDisposition(o)}
                              onStockBadgeClick={handleStockBadgeClick ? () => handleStockBadgeClick(o.id) : undefined}
                              isLastInGroup={rowIndex === group.orders.length - 1}
                            />
                          );
                        })
                      : null}
                  </Fragment>
                );
              })
            }
          />
          </DataTable>
        </div>
          </TableScroll>
        </>
      )}
    </>
  );
}
