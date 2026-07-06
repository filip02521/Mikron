"use client";

import { useMemo, useState } from "react";
import { actionSetProcurementCancelDisposition } from "@/app/actions/admin";
import type { SalesCancelledNoticeLine } from "@/lib/orders/sales-cancelled-notices";
import {
  countPendingDispositionChoices,
  procurementDispositionSaveSummary,
  type ProcurementCancelDisposition,
} from "@/lib/orders/procurement-disposition";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  controlFocusClass,
  panelChoiceChipClass,
  panelChoiceChipIdleClass,
  panelChoiceChipSelectedClass,
  panelChoiceChipSuccessSelectedClass,
  panelTypography,
} from "@/lib/ui/ontime-theme";

export type SalesCancelDispositionFormProps = {
  personName: string;
  phase: SalesCancelPhase;
  lines: SalesCancelledNoticeLine[];
  disabled?: boolean;
  onDone: (message: string, isError: boolean) => void;
};

function DispositionChip({
  label,
  selected,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  tone: "stock" | "return";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        panelChoiceChipClass,
        "px-2.5 py-1.5 text-[11px] sm:min-w-[7.5rem]",
        selected
          ? tone === "stock"
            ? panelChoiceChipSuccessSelectedClass
            : panelChoiceChipSelectedClass
          : panelChoiceChipIdleClass
      )}
    >
      {label}
    </button>
  );
}

function DispositionLineRow({
  line,
  choice,
  disabled,
  onChoose,
}: {
  line: SalesCancelledNoticeLine;
  choice: ProcurementCancelDisposition | null;
  disabled?: boolean;
  onChoose: (value: ProcurementCancelDisposition) => void;
}) {
  const isInformacja = line.requestKind === "informacja";
  const qtyLabel =
    !isInformacja && line.quantity && line.quantity !== "-" && line.quantity !== "—"
      ? line.quantity
      : null;

  return (
    <li className="rounded-md border border-slate-100/90 bg-slate-50/60 px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-snug text-slate-900">{line.products}</p>
          {(line.symbol && line.symbol !== "-") || qtyLabel ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              {line.symbol && line.symbol !== "-" ? line.symbol : null}
              {line.symbol && line.symbol !== "-" && qtyLabel ? " · " : null}
              {qtyLabel ? `${qtyLabel} szt.` : null}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end">
          <DispositionChip
            label="Na stan"
            tone="stock"
            selected={choice === "to_stock"}
            disabled={disabled}
            onClick={() => onChoose("to_stock")}
          />
          <DispositionChip
            label="Do zwrotu"
            tone="return"
            selected={choice === "return"}
            disabled={disabled}
            onClick={() => onChoose("return")}
          />
        </div>
      </div>
    </li>
  );
}

export function SalesCancelDispositionForm({
  personName,
  phase,
  lines,
  disabled = false,
  onDone,
}: SalesCancelDispositionFormProps) {
  const dispositionLines = useMemo(
    () => lines.filter((line) => line.needsDisposition),
    [lines]
  );
  const infoLines = useMemo(
    () => lines.filter((line) => !line.needsDisposition),
    [lines]
  );
  const dispositionLineIds = useMemo(
    () => dispositionLines.map((line) => line.id),
    [dispositionLines]
  );

  const [choices, setChoices] = useState<
    Record<string, ProcurementCancelDisposition | null>
  >({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const phaseHint =
    phase === "on_stock"
      ? "Po rezygnacji handlowca towar jest na magazynie — wybierz, co z każdą pozycją."
      : "Handlowiec zrezygnował — towar może jeszcze dotrzeć. Wybierz, co z każdą pozycją.";

  const { chosen, total } = countPendingDispositionChoices(dispositionLineIds, choices);
  const allChosen = total === 0 || chosen === total;
  const busy = disabled || saving;

  const applyBulk = (value: ProcurementCancelDisposition) => {
    setChoices((prev) => {
      const next = { ...prev };
      for (const id of dispositionLineIds) {
        next[id] = value;
      }
      return next;
    });
  };

  const save = async () => {
    if (!allChosen) return;
    setSaving(true);
    try {
      const sharedNote = note.trim() || undefined;
      const entries = dispositionLines.map((line) => ({
        orderId: line.id,
        disposition: choices[line.id]!,
        note: sharedNote,
      }));
      await actionSetProcurementCancelDisposition(entries, {
        acknowledgeOrderIds: infoLines.map((line) => line.id),
      });
      onDone(procurementDispositionSaveSummary(entries, personName), false);
    } catch (e) {
      onDone(e instanceof Error ? e.message : "Nie udało się zapisać", true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-600">{phaseHint}</p>

      {dispositionLines.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={panelTypography.caption}>Szybko dla wszystkich:</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyBulk("to_stock")}
            className={cn(
              panelChoiceChipClass,
              panelChoiceChipIdleClass,
              "px-2.5 py-1 text-[11px]"
            )}
          >
            Wszystkie na stan
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => applyBulk("return")}
            className={cn(
              panelChoiceChipClass,
              panelChoiceChipIdleClass,
              "px-2.5 py-1 text-[11px]"
            )}
          >
            Wszystkie do zwrotu
          </button>
        </div>
      ) : null}

      {dispositionLines.length ? (
        <fieldset className="space-y-2" disabled={busy}>
          <legend className="text-xs font-medium text-slate-800">
            Rezygnacja — co z towarem?
          </legend>
          <ul className="space-y-2">
            {dispositionLines.map((line) => (
              <DispositionLineRow
                key={line.id}
                line={line}
                choice={choices[line.id] ?? null}
                disabled={busy}
                onChoose={(value) =>
                  setChoices((prev) => ({ ...prev, [line.id]: value }))
                }
              />
            ))}
          </ul>
        </fieldset>
      ) : null}

      {infoLines.length ? (
        <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
          <p className="text-[11px] font-medium text-slate-700">
            Rezygnacja przed zamówieniem u dostawcy
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
            {infoLines.map((line) => (
              <li key={line.id}>
                <span className="font-medium text-slate-800">{line.symbol}</span>
                {" — "}
                {line.products}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {dispositionLines.length ? (
        <label className="block">
          <span className="text-[11px] font-medium text-slate-600">
            Notatka dla magazynu (wspólna)
          </span>
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
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        {dispositionLines.length ? (
          <p className={cn(panelTypography.caption, !allChosen && "text-amber-800")}>
            {allChosen
              ? `${total} ${total === 1 ? "pozycja gotowa" : "pozycje gotowe"} do zapisu`
              : `Decyzja dla każdej pozycji: ${chosen} z ${total}`}
          </p>
        ) : (
          <p className={panelTypography.caption}>Do zapoznania — bez decyzji o towarze</p>
        )}
        <Button
          size="sm"
          disabled={busy || (dispositionLines.length > 0 && !allChosen)}
          onClick={() => void save()}
        >
          {saving
            ? "Zapisywanie…"
            : dispositionLines.length
              ? total === 1
                ? "Zapisz decyzję"
                : "Zapisz decyzje"
              : "Zapoznałem się — ukryj"}
        </Button>
      </div>
    </div>
  );
}
