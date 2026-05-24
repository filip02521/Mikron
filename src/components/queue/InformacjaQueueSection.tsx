"use client";

import { useMemo, useTransition, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import { actionMarkInformacjaArrived } from "@/app/actions/admin";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { Toast } from "@/components/ui/Toast";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { supplierKey } from "@/lib/orders/queue-supplier-groups";
import {
  informacjaProductKey,
  informacjaProductTitle,
  orderIdsInProductGroup,
  productGroupIndexByOrderId,
  queueInformacjaProductRowClass,
} from "@/lib/orders/queue-product-groups";
import {
  batchNotifyButtonLabel,
  countSalesPeopleInOrders,
  formatInformacjaBatchToast,
} from "@/lib/orders/queue-batch-notify";

export function InformacjaQueueSection({ orders }: { orders: IndividualOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismissToast = useCallback(() => setToast(null), []);

  const productGroups = useMemo(
    () => productGroupIndexByOrderId(orders),
    [orders]
  );

  const selectedIds = useMemo(
    () => orders.filter((o) => selected[o.id]).map((o) => o.id),
    [orders, selected]
  );

  const allSelected = orders.length > 0 && orders.every((o) => selected[o.id]);

  const toggleSelected = (orderId: string) => {
    setSelected((s) => ({ ...s, [orderId]: !s[orderId] }));
  };

  const toggleProductGroup = (startIndex: number, checked: boolean) => {
    const ids = orderIdsInProductGroup(orders, startIndex);
    setSelected((s) => {
      const next = { ...s };
      for (const id of ids) next[id] = checked;
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelected(checked ? Object.fromEntries(orders.map((o) => [o.id, true])) : {});
  };

  const markArrived = (orderIds: string[]) => {
    setPendingMessage(
      orderIds.length > 1 ? "Wysyłanie powiadomień…" : "Powiadamianie handlowca…"
    );
    start(async () => {
      try {
        const r = await actionMarkInformacjaArrived(orderIds);
        if ("error" in r) {
          setToast({ text: r.error, tone: "error" });
          return;
        }
        setSelected((s) => {
          const next = { ...s };
          for (const id of orderIds) delete next[id];
          return next;
        });
        setToast(formatInformacjaBatchToast(r));
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

  const headerNotifyLabel = useMemo(() => {
    if (!orders.length) return "Powiadom wszystkich";
    const emails = countSalesPeopleInOrders(orders, orders.map((o) => o.id));
    if (emails <= 1) return `Powiadom wszystkich (${orders.length}) — mail do handlowca`;
    return `Powiadom wszystkich (${orders.length}) — ${emails} handlowców`;
  }, [orders]);

  const selectedHeaderLabel = useMemo(() => {
    if (selectedIds.length <= 1) return "Powiadom zaznaczone";
    const emails = countSalesPeopleInOrders(orders, selectedIds);
    return emails <= 1
      ? `Powiadom zaznaczone (${selectedIds.length}) — mail do handlowca`
      : `Powiadom zaznaczone (${selectedIds.length}) — ${emails} handlowców`;
  }, [orders, selectedIds]);

  return (
    <div className="relative space-y-4">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="section" />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}

      <Card padding={false} className="overflow-hidden border-sky-200">
        <CardHeader
          inset
          title="Pozycje informacyjne"
          description={
            orders.length
              ? `${orders.length} ${orders.length === 1 ? "pozycja" : "pozycji"} w kolejce`
              : "Brak oczekujących"
          }
          action={
            selectedIds.length > 0 ? (
              <Button
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => markArrived(selectedIds)}
              >
                {selectedHeaderLabel}
              </Button>
            ) : orders.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => markArrived(orders.map((o) => o.id))}
              >
                {headerNotifyLabel}
              </Button>
            ) : undefined
          }
        />

        {!orders.length ? (
          <EmptyState
            title="Brak pozycji informacyjnych"
            description="Nowe prośby „Informacja gdy dotarło” pojawią się tutaj po zgłoszeniu przez handlowca."
          />
        ) : (
          <TableScroll className="px-0 pb-0">
            <DataTable className="text-sm">
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                      checked={allSelected}
                      disabled={pending}
                      aria-label="Zaznacz wszystkie pozycje informacyjne"
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="min-w-[7rem]">Dla kogo</th>
                  <th className="min-w-[6rem]">Dostawca</th>
                  <th className="min-w-[10rem]">Produkt</th>
                  <th className="w-[11rem] text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, index) => {
                  const personName = o.sales_person?.name?.trim() || "—";
                  const supplierName = supplierKey(o);
                  const groupIndex = productGroups.get(o.id) ?? 0;
                  const prevKey =
                    index > 0 ? informacjaProductKey(orders[index - 1]!) : null;
                  const isFirstInProductGroup =
                    informacjaProductKey(o) !== prevKey;
                  const groupIds = isFirstInProductGroup
                    ? orderIdsInProductGroup(orders, index)
                    : [];
                  const groupAllSelected =
                    groupIds.length > 0 && groupIds.every((id) => selected[id]);
                  const productTitle = informacjaProductTitle(o);

                  return (
                    <tr
                      key={o.id}
                      className={queueInformacjaProductRowClass(groupIndex, {
                        isFirstInProductGroup,
                      })}
                    >
                      <td className="text-center align-top pt-3">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500/30"
                          checked={!!selected[o.id]}
                          disabled={pending}
                          aria-label={`Zaznacz pozycję ${personName}`}
                          onChange={() => toggleSelected(o.id)}
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{personName}</span>
                        <Badge variant="info" className="ml-2 align-middle text-[10px]">
                          Informacja
                        </Badge>
                      </td>
                      <td
                        className="max-w-[8rem] truncate text-slate-700"
                        title={supplierName}
                      >
                        {supplierName}
                      </td>
                      <td className="max-w-[14rem]">
                        {isFirstInProductGroup ? (
                          <div className="flex flex-col gap-1">
                            <span
                              className="line-clamp-2 font-semibold text-slate-900"
                              title={productTitle}
                            >
                              {o.products}
                            </span>
                            {o.symbol && o.symbol !== "-" ? (
                              <span className="text-xs font-medium text-slate-600">
                                {o.symbol}
                              </span>
                            ) : null}
                            {groupIds.length > 1 ? (
                              <span className="text-[10px] font-semibold text-sky-800">
                                {groupIds.length}{" "}
                                {groupIds.length === 1
                                  ? "osoba pyta"
                                  : groupIds.length < 5
                                    ? "osoby pytają"
                                    : "osób pyta"}{" "}
                                o ten towar
                              </span>
                            ) : null}
                            {groupIds.length > 1 ? (
                              <button
                                type="button"
                                className="text-left text-[10px] font-semibold text-sky-800 underline-offset-2 hover:underline"
                                disabled={pending}
                                onClick={() => toggleProductGroup(index, !groupAllSelected)}
                              >
                                {groupAllSelected
                                  ? "Odznacz ten towar"
                                  : `Zaznacz wszystkich (${groupIds.length})`}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">↳ ten sam towar</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col items-end gap-1">
                          {isFirstInProductGroup && groupIds.length > 1 ? (
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-xs font-semibold"
                              disabled={pending}
                              onClick={() => markArrived(groupIds)}
                            >
                              {batchNotifyButtonLabel(orders, groupIds, {
                                prefix: "Ten towar na magazynie",
                                unit: "osoba",
                              })}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-xs font-semibold"
                              disabled={pending}
                              onClick={() => markArrived([o.id])}
                            >
                              Na magazynie — wyślij e-mail
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </TableScroll>
        )}
      </Card>
    </div>
  );
}

