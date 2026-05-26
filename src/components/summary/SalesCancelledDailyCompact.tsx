"use client";

import { useMemo, useState } from "react";
import type { SalesCancelledNotice } from "@/lib/orders/sales-cancelled-notices";
import { locationLabel } from "@/lib/display-labels";
import { actionAcknowledgeProcurementSalesCancel } from "@/app/actions/admin";
import { ModalShell } from "@/components/ui/ModalShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SalesCancelDispositionForm } from "@/components/summary/SalesCancelDispositionForm";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import {
  panelNoticeTriggerBaseClass,
  panelNoticeTriggerDefaultClass,
  panelNoticeTriggerUrgentClass,
} from "@/lib/ui/ontime-theme";

function noticeSummary(notices: SalesCancelledNotice[]): string {
  const toSettle = notices.filter((n) => n.needsDisposition).length;
  const toAck = notices.filter((n) => !n.needsDisposition).length;
  const parts: string[] = [];
  if (toSettle > 0) {
    parts.push(
      toSettle === 1 ? "1 do rozliczenia" : `${toSettle} do rozliczenia`
    );
  }
  if (toAck > 0) {
    parts.push(toAck === 1 ? "1 do zapoznania" : `${toAck} do zapoznania`);
  }
  return parts.join(" · ");
}

export function SalesCancelledDailyCompact({
  notices,
  isScopePending,
  run,
}: {
  notices: SalesCancelledNotice[];
  isScopePending: (scope: string) => boolean;
  run: DailyPanelRunFn;
}) {
  const noticeScope = (n: SalesCancelledNotice) => `cancel-${n.orderIds[0] ?? n.person}`;
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => noticeSummary(notices), [notices]);

  if (!notices.length) return null;

  const hasUrgent = notices.some((n) => n.needsDisposition);

  return (
    <>
      <button
        type="button"
        id="rezygnacje"
        onClick={() => setOpen(true)}
        className={cn(
          panelNoticeTriggerBaseClass,
          hasUrgent ? panelNoticeTriggerUrgentClass : panelNoticeTriggerDefaultClass
        )}
      >
        <span className="min-w-0 truncate">
          <span
            className={cn(
              "font-medium",
              hasUrgent ? "text-amber-950" : "text-slate-800"
            )}
          >
            Rezygnacje handlowców
          </span>
          <span
            className={cn(
              "font-normal",
              hasUrgent ? "text-amber-900/85" : "text-slate-500"
            )}
          >
            {" "}
            · {summary}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            hasUrgent ? "text-amber-800" : "text-slate-500"
          )}
        >
          Szczegóły →
        </span>
      </button>

      <ModalShell
        open={open}
        onClose={() => setOpen(false)}
        title="Rezygnacje handlowców"
        description="Rozlicz rezygnacje po zamówieniu u dostawcy. Decyzja pojawi się przy wpisie w kolejce dostaw (Magazyn i regał)."
        size="lg"
      >
        <ul className="max-h-[min(70vh,28rem)] space-y-3 overflow-y-auto pr-1">
          {notices.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {n.person}
                    <span className="font-normal text-slate-500"> · {n.supplierName}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-600">
                    {locationLabel(n.location)} · {n.cancelledLabel}
                    {n.clientName ? ` · ${n.clientName}` : null}
                  </p>
                </div>
                <Badge variant="warning" className="shrink-0 text-[10px]">
                  {n.phase === "before_order" ? "Wycofane" : "Rezygnacja"}
                </Badge>
              </div>

              {n.needsDisposition ? (
                <div className="mt-3 border-t border-slate-200/80 pt-3">
                  <SalesCancelDispositionForm
                    orderIds={n.orderIds}
                    personName={n.person}
                    supplierName={n.supplierName}
                    phase={
                      n.phase === "on_stock" || n.phase === "in_transit"
                        ? n.phase
                        : "in_transit"
                    }
                    lines={n.lines}
                    disabled={isScopePending(noticeScope(n))}
                    onDone={(message, isError) => {
                      const scope = { scope: noticeScope(n) };
                      if (isError) {
                        run(async () => {
                          throw new Error(message);
                        }, message, "", scope);
                        return;
                      }
                      setOpen(false);
                      run(async () => ({ success: true }), message, "Zapisywanie…", scope);
                    }}
                  />
                </div>
              ) : (
                <>
                  <ul className="mt-2 space-y-0.5 text-[11px] text-slate-700">
                    {n.lines.map((line) => (
                      <li key={line.id}>
                        <span className="font-medium">{line.symbol}</span>
                        {" — "}
                        {line.products}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 px-2 text-[11px] text-slate-600"
                    disabled={isScopePending(noticeScope(n))}
                    onClick={() =>
                      run(
                        () => actionAcknowledgeProcurementSalesCancel(n.orderIds),
                        "Ukryto",
                        "Zapisywanie…",
                        { scope: noticeScope(n) }
                      )
                    }
                  >
                    Zapoznałem się — ukryj
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </ModalShell>
    </>
  );
}
