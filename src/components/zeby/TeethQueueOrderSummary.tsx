"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { plProsba } from "@/lib/ui/polish-plurals";
import { IconCircleCheck, IconClipboardList } from "@/components/icons/StrokeIcons";
import type { TeethQueueItem } from "@/lib/data/teeth-queue-shared";
import {
  aggregateTeethSupplierOrder,
  formatTeethAggregateForClipboard,
  teethJawLabel,
  teethKindLabel,
} from "@/lib/teeth/teeth-queue-view-model";

/** Zbiorcze zestawienie zębów do wpisania w zamówienie u dostawcy. */
export function TeethQueueOrderSummary({
  supplierName,
  items,
}: {
  supplierName: string;
  items: TeethQueueItem[];
}) {
  const lines = useMemo(() => aggregateTeethSupplierOrder(items), [items]);
  const total = lines.reduce((sum, l) => sum + l.quantity, 0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatTeethAggregateForClipboard(supplierName, lines));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (lines.length === 0) {
    return (
      <p className="border-b border-slate-100 bg-indigo-50/30 px-4 py-3 text-xs text-slate-500 sm:px-5">
        Brak zębów do zamówienia — prośby nie mają jeszcze listy.
      </p>
    );
  }

  return (
    <div className="border-b border-slate-100 bg-indigo-50/30 px-4 py-3 sm:px-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          Wszystkie niezamówione zęby u tego dostawcy, zsumowane. Skopiuj i wklej do zamówienia.
        </p>
        <Button size="sm" variant="secondary" className="min-h-8" onClick={() => void copy()}>
          {copied ? <IconCircleCheck size={14} className="text-emerald-600" /> : <IconClipboardList size={14} />}
          {copied ? "Skopiowano" : "Kopiuj zestawienie"}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[26rem] text-left text-sm">
          <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Kolor</th>
              <th className="px-3 py-2">Fason</th>
              <th className="px-3 py-2">Szczęka</th>
              <th className="px-3 py-2">Typ</th>
              <th className="px-3 py-2 text-right">Ilość</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.key}>
                <td className="px-3 py-1.5 font-semibold text-slate-900">{l.color || "—"}</td>
                <td className="px-3 py-1.5 font-medium text-slate-800">{l.mould?.trim() || "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{teethJawLabel(l.jaw, l.kind, l.mould) ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{teethKindLabel(l.kind) ?? "—"}</td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-900">
                  {l.quantity}
                  {l.orderCount > 1 ? (
                    <span className="ml-1 text-[11px] font-normal text-slate-400">
                      ({l.orderCount} {plProsba(l.orderCount)})
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50/70">
            <tr>
              <td colSpan={4} className="px-3 py-1.5 text-xs font-semibold text-slate-600">
                Razem
              </td>
              <td className="px-3 py-1.5 text-right font-bold tabular-nums text-slate-900">{total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
