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
import { SUMMARY_COLORS } from "@/types/database";
import { ActionLoadingOverlay } from "@/components/ui/ActionLoadingOverlay";
import { cn } from "@/lib/cn";
import {
  queueSupplierRowClass,
  supplierGroupIndexByOrderId,
  supplierKey,
} from "@/lib/orders/queue-supplier-groups";

export function InformacjaQueueSection({ orders }: { orders: IndividualOrder[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: "success" | "error" } | null>(
    null
  );
  const dismissToast = useCallback(() => setToast(null), []);

  const supplierGroups = useMemo(
    () => supplierGroupIndexByOrderId(orders),
    [orders]
  );

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
        const extra = r.emailError
          ? ` Uwaga: ${r.emailError}`
          : r.emailSent
            ? ` Wysłano ${r.emailSent} e-mail(i).`
            : "";
        setToast({
          text: `Powiadomiono handlowca (${r.updated} poz.)${extra}`,
          tone: r.emailError ? "error" : "success",
        });
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
              ? `${orders.length} ${orders.length === 1 ? "pozycja" : "pozycji"} · alfabetycznie po dostawcy`
              : "Brak oczekujących"
          }
          action={
            orders.length > 1 ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => markArrived(orders.map((o) => o.id))}
              >
                Powiadom wszystkich
              </Button>
            ) : undefined
          }
        />

        <div
          className="border-b border-sky-100 px-6 py-3 text-sm leading-relaxed text-sky-950"
          style={{ backgroundColor: SUMMARY_COLORS.informacja }}
        >
          <p className="font-medium">
            Tylko informacja — bez rezerwacji towaru na regale dla handlowca
          </p>
          <p className="mt-1 text-sky-900/90">
            Towar odkładacie na standardowe miejsce w magazynie. Gdy jest dostępny, wyślij
            e-mail — pozycja nie trafia do historii realizacji indywidualnej.
          </p>
        </div>

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
                  const groupIndex = supplierGroups.get(o.id) ?? 0;
                  const prevSupplier =
                    index > 0 ? supplierKey(orders[index - 1]!) : null;
                  const isFirstInSupplierGroup = supplierName !== prevSupplier;
                  const productTitle = [
                    o.products,
                    o.symbol && o.symbol !== "-" ? `(${o.symbol})` : null,
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <tr
                      key={o.id}
                      className={queueSupplierRowClass(groupIndex, {
                        variant: "informacja",
                        isFirstInSupplierGroup,
                      })}
                    >
                      <td className="whitespace-nowrap">
                        <span className="font-semibold text-slate-900">{personName}</span>
                        <Badge variant="info" className="ml-2 align-middle text-[10px]">
                          Informacja
                        </Badge>
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
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <Button
                            variant="primary"
                            size="sm"
                            className="text-xs font-semibold"
                            disabled={pending}
                            onClick={() => markArrived([o.id])}
                          >
                            Na magazynie — wyślij e-mail
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
    </div>
  );
}
