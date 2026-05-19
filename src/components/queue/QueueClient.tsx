"use client";

import { useMemo, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { IndividualOrder } from "@/types/database";
import { actionUpdateDelivered } from "@/app/actions/admin";
import { getDeliveryProgress, parseOrderQuantity } from "@/lib/orders/individual";
import { procurementDispositionQueueLabel } from "@/lib/orders/procurement-disposition";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { DataTable, TableScroll } from "@/components/ui/DataTable";
import { cn } from "@/lib/cn";
import { InformacjaQueueSection } from "@/components/queue/InformacjaQueueSection";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { QueuePanelToolbar } from "@/components/queue/QueuePanelToolbar";
import { summarizeQueueInbox } from "@/lib/orders/queue-inbox";
import {
  queueSupplierRowClass,
  supplierGroupIndexByOrderId,
  supplierKey,
} from "@/lib/orders/queue-supplier-groups";

export function QueueClient({
  orders,
  informacjaOrders,
  pickupReadyCount,
}: {
  orders: IndividualOrder[];
  informacjaOrders: IndividualOrder[];
  pickupReadyCount: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );

  const dismissToast = useCallback(() => setToast(null), []);

  const shelf = useMemo(
    () => orders.filter((o) => !o.sales_cancelled_at || o.procurement_cancel_disposition),
    [orders]
  );
  const inboxSummary = useMemo(() => summarizeQueueInbox(orders), [orders]);

  const getQty = (o: IndividualOrder) => {
    if (qty[o.id] !== undefined) return qty[o.id];
    const d = o.delivered_quantity;
    if (d && d !== "-") return d;
    return "";
  };

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

  const supplierGroups = useMemo(
    () => supplierGroupIndexByOrderId(shelf),
    [shelf]
  );

  const partialCount = inboxSummary.partialCount;
  const cancelLabelled = inboxSummary.cancelLabelledCount;

  return (
    <div className="relative space-y-6">
      {pendingMessage ? (
        <ActionLoadingOverlay message={pendingMessage} variant="viewport" />
      ) : null}
      {toast ? (
        <Toast message={toast.text} tone={toast.tone} onDismiss={dismissToast} />
      ) : null}

      <QueuePanelToolbar
        summary={inboxSummary}
        informacjaCount={informacjaOrders.length}
        pickupReadyCount={pickupReadyCount}
      />

      <details className="rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
        <summary className="cursor-pointer px-4 py-2.5 font-medium text-slate-800 marker:content-none [&::-webkit-details-marker]:hidden">
          Jak wpisywać dostawy
        </summary>
        <p className="border-t border-slate-100 px-4 py-2.5 leading-relaxed">
          <strong>Dostawy dla handlowców</strong> — gdy towar fizycznie przyszedł, wpisz ilość w
          kolumnie „Dost.” i zapisz (lub <strong>Całość</strong>). Handlowiec dostaje powiadomienie.
          Przy rezygnacji widać decyzję zakupów (stan lub zwrot).{" "}
          <strong>Informacje</strong> poniżej — tylko e-mail po dotarciu towaru (bez kolejki dostaw).
        </p>
      </details>

      <section id="dostawy-handlowcy" className="scroll-mt-20">
        <Card padding={false} className="overflow-hidden border-violet-200">
          <CardHeader
            inset
            title="Dostawy dla handlowców"
            description={
              shelf.length
                ? `${shelf.length} poz. w kolejce · ${pickupReadyCount} gotowych do odbioru u handlowców · ${partialCount} częściowo przyjęte${cancelLabelled ? ` · ${cancelLabelled} z rezygnacją (decyzja zakupów)` : ""}`
                : "Brak pozycji — po Główne/Uzupełniające w panelu dziennym"
            }
          />

          {!shelf.length ? (
            <EmptyState
              title="Kolejka dostaw jest pusta"
              description="Tu trafiają zamówienia już złożone u dostawcy. Gdy towar dotrze, wpisz ilość na liście i zapisz — wtedy handlowiec dostanie informację."
            />
          ) : (
            <TableScroll className="px-0 pb-0">
              <DataTable className="queue-table text-sm">
                <thead>
                  <tr>
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
                  {shelf.map((o, index) => {
                    const personName = o.sales_person?.name?.trim() || "—";
                    const supplierName = supplierKey(o);
                    const groupIndex = supplierGroups.get(o.id) ?? 0;
                    const prevSupplier =
                      index > 0 ? supplierKey(shelf[index - 1]!) : null;
                    const isFirstInSupplierGroup = supplierName !== prevSupplier;
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
                            isFirstInSupplierGroup,
                          }),
                          salesCancelRow && "bg-amber-50/50"
                        )}
                        title={
                          isPartial && progress.hasNumericQty
                            ? `Częściowo zrealizowane — czeka na ${progress.remaining} szt.`
                            : undefined
                        }
                      >
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
                        <td
                          className={cn(
                            "max-w-[8rem] truncate",
                            isFirstInSupplierGroup
                              ? "font-semibold text-slate-900"
                              : "text-slate-500"
                          )}
                          title={supplierName}
                        >
                          {isFirstInSupplierGroup ? supplierName : "↳ ten sam dostawca"}
                        </td>
                        <td className="max-w-[14rem]">
                          <span className="line-clamp-2 text-slate-800" title={productTitle}>
                            {o.products}
                          </span>
                          {o.symbol && o.symbol !== "-" ? (
                            <span className="text-xs text-slate-500">{o.symbol}</span>
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
                            className="w-14 rounded-md border border-slate-200 px-1.5 py-1 text-center text-sm font-semibold tabular-nums text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50"
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
                  })}
                </tbody>
              </DataTable>
            </TableScroll>
          )}
        </Card>
      </section>

      <section id="informacja" className="scroll-mt-20">
        <InformacjaQueueSection orders={informacjaOrders} />
      </section>
    </div>
  );
}
