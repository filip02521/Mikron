"use client";

import { useState } from "react";
import { actionSetProcurementCancelDisposition } from "@/app/actions/admin";
import type { ProcurementCancelDisposition } from "@/lib/orders/procurement-disposition";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelChoiceChipSuccessSelectedClass,
} from "@/lib/ui/ontime-theme";

export type SalesCancelDispositionFormProps = {
  orderIds: string[];
  personName: string;
  supplierName: string;
  phase: SalesCancelPhase;
  lines: { id: string; products: string; symbol: string; quantity: string }[];
  disabled?: boolean;
  onDone: (message: string, isError: boolean) => void;
};

export function SalesCancelDispositionForm({
  orderIds,
  personName,
  supplierName,
  phase,
  lines,
  disabled = false,
  onDone,
}: SalesCancelDispositionFormProps) {
  const [disposition, setDisposition] = useState<ProcurementCancelDisposition | null>(
    null
  );
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const phaseHint =
    phase === "on_stock"
      ? "Towar jest lub był na magazynie."
      : "Towar może jeszcze dotrzeć mimo rezygnacji.";

  const save = async () => {
    if (!disposition) return;
    setSaving(true);
    try {
      await actionSetProcurementCancelDisposition(orderIds, disposition, note || undefined);
      onDone(
        disposition === "to_stock"
          ? `Rozliczono: na stan — ${personName}`
          : `Rozliczono: zwrot — ${personName}`,
        false
      );
    } catch (e) {
      onDone(e instanceof Error ? e.message : "Nie udało się zapisać", true);
    } finally {
      setSaving(false);
    }
  };

  const busy = disabled || saving;

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-600">{phaseHint}</p>
      <ul className="space-y-0.5 text-[11px] text-slate-700">
        {lines.map((line) => (
          <li key={line.id}>
            <span className="font-medium">{line.symbol}</span>
            {" — "}
            {line.products}
            {line.quantity !== "-" ? ` (${line.quantity})` : null}
          </li>
        ))}
      </ul>
      <fieldset className="space-y-2" disabled={busy}>
        <legend className="text-xs font-medium text-slate-800">
          Decyzja zakupów — co z towarem?
        </legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDisposition("to_stock")}
            className={cn(
              panelChoiceChipClass,
              disposition === "to_stock"
                ? panelChoiceChipSuccessSelectedClass
                : panelChoiceChipIdleClass
            )}
          >
            Na stan magazynu
          </button>
          <button
            type="button"
            onClick={() => setDisposition("return")}
            className={cn(
              panelChoiceChipClass,
              disposition === "return"
                ? panelChoiceChipSelectedClass
                : panelChoiceChipIdleClass
            )}
          >
            Przygotować do zwrotu
          </button>
        </div>
        <label className="block">
          <span className="text-[11px] font-medium text-slate-600">Notatka dla magazynu</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="np. regał B3, list przewozowy…"
            className={cn(
              "mt-1 w-full resize-y rounded-md border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400",
              controlFocusClass
            )}
          />
        </label>
        <Button size="sm" disabled={busy || !disposition} onClick={() => void save()}>
          {saving ? "Zapisywanie…" : "Zapisz decyzję"}
        </Button>
      </fieldset>
    </div>
  );
}
