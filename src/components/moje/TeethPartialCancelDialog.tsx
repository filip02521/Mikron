"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ModalShell } from "@/components/ui/ModalShell";
import {
  groupTeethDetails,
  formatTeethGroupLabel,
  type TeethLineDetail,
} from "@/lib/teeth/teeth-catalog";
import { teethReceiveGroupKey } from "@/lib/teeth/teeth-receive-picker";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { cn } from "@/lib/cn";

type CancelGroupEntry = {
  color: string;
  mould: string | null;
  jaw: string | null;
  kind: string | null;
  count: number;
};

export function TeethPartialCancelDialog({
  open,
  product,
  phase,
  teethDetails,
  teethLineDelivered,
  pending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  product: string;
  phase: SalesCancelPhase;
  teethDetails: TeethLineDetail[];
  teethLineDelivered?: Record<string, number> | null;
  pending?: boolean;
  onConfirm: (cancelGroups: CancelGroupEntry[]) => void;
  onCancel: () => void;
}) {
  const groups = useMemo(() => groupTeethDetails(teethDetails), [teethDetails]);

  const [cancelQty, setCancelQty] = useState<Record<string, number>>({});

  const totalOrdered = groups.reduce((sum, g) => sum + g.count, 0);
  const totalDelivered = groups.reduce((sum, g) => {
    const key = teethReceiveGroupKey(g);
    return sum + (teethLineDelivered?.[key] ?? 0);
  }, 0);

  const totalCancel = groups.reduce((sum, g) => {
    const key = teethReceiveGroupKey(g);
    return sum + (cancelQty[key] ?? 0);
  }, 0);

  const canConfirm = totalCancel > 0;

  const phaseLabel =
    phase === "before_order"
      ? "przed zamówieniem"
      : phase === "in_transit"
        ? "w drodze od dostawcy"
        : "na magazynie";

  return (
    <ModalShell
      open={open}
      onClose={onCancel}
      title="Wycofaj grupy zębów"
      titleId="teeth-partial-cancel-title"
      role="alertdialog"
      size="md"
      tier="stack"
      disableBackdropClose={pending}
      loadingMessage={pending ? "Przetwarzanie…" : null}
      bodyClassName="px-5 py-4 sm:px-6"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            className="min-h-11 w-full sm:w-auto"
            onClick={onCancel}
            disabled={pending}
          >
            Zostaw bez zmian
          </Button>
          <Button
            variant="danger"
            className="min-h-11 w-full sm:w-auto"
            disabled={pending || !canConfirm}
            onClick={() => {
              const entries: CancelGroupEntry[] = [];
              for (const g of groups) {
                const key = teethReceiveGroupKey(g);
                const qty = cancelQty[key] ?? 0;
                if (qty > 0) {
                  entries.push({
                    color: g.color,
                    mould: g.mould,
                    jaw: g.jaw,
                    kind: g.kind,
                    count: qty,
                  });
                }
              }
              onConfirm(entries);
            }}
          >
            {totalCancel > 0
              ? `Wycofaj ${totalCancel} ${totalCancel === 1 ? "szt." : "szt."}`
              : "Wycofaj"}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-slate-600">
        Pozycja „{product}” — {phaseLabel}. Zaznacz które grupy kłapek wycofać.
        {totalDelivered > 0
          ? " Przyjęte sztuki nie podlegają wycofaniu."
          : ""}
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Grupa</th>
              <th className="px-3 py-2 text-center">Zamów.</th>
              <th className="px-3 py-2 text-center">Przyj.</th>
              <th className="px-3 py-2 text-center">Wycofaj</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groups.map((g) => {
              const key = teethReceiveGroupKey(g);
              const delivered = teethLineDelivered?.[key] ?? 0;
              const maxCancel = Math.max(0, g.count - delivered);
              const current = cancelQty[key] ?? 0;
              const disabled = maxCancel === 0;

              return (
                <tr
                  key={key}
                  className={cn(
                    "transition-colors",
                    disabled ? "bg-slate-50/50 opacity-60" : "bg-white",
                  )}
                >
                  <td className="px-3 py-2.5 font-medium text-slate-800">
                    {formatTeethGroupLabel(g, { includeCount: false })}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">
                    {g.count}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-slate-600">
                    {delivered}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={pending || disabled || current <= 0}
                        aria-label="Zmniejsz ilość do wycofania"
                        onClick={() =>
                          setCancelQty((prev) => ({
                            ...prev,
                            [key]: Math.max(0, current - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <span
                        className={cn(
                          "min-w-[2rem] text-center text-sm font-semibold tabular-nums",
                          current > 0 ? "text-rose-700" : "text-slate-400",
                        )}
                      >
                        {current}
                      </span>
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={pending || disabled || current >= maxCancel}
                        aria-label="Zwiększ ilość do wycofania"
                        onClick={() =>
                          setCancelQty((prev) => ({
                            ...prev,
                            [key]: Math.min(maxCancel, current + 1),
                          }))
                        }
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <td className="px-3 py-2">Razem</td>
              <td className="px-3 py-2 text-center tabular-nums">{totalOrdered}</td>
              <td className="px-3 py-2 text-center tabular-nums">{totalDelivered}</td>
              <td className="px-3 py-2 text-center tabular-nums text-rose-700">
                {totalCancel}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </ModalShell>
  );
}
