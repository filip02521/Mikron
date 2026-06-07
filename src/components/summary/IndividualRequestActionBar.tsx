"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { RequestGroupOverflowMenu } from "@/components/summary/RequestGroupOverflowMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import { panelSegmentLastClass, panelSegmentOutlineClass, panelSegmentPrimaryClass } from "@/lib/ui/ontime-theme";
import { buttonGroupItemClass, panelActionBarShellClass, panelActionSegmentClass } from "@/lib/ui/surfaces";
import { actionProcessIndividual } from "@/app/actions/admin";

const nestedOutlineSegmentClass = cn(
  panelActionSegmentClass,
  "px-2 text-[11px] font-semibold",
  "border-0 border-l border-slate-200 bg-slate-50 text-slate-700",
  "transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
);

const nestedPrimarySegmentClass = cn(
  panelActionSegmentClass,
  "px-2 text-[11px] font-semibold",
  "border-0 bg-indigo-600 text-white",
  "transition-colors duration-150 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
);

const nestedShellClass =
  "inline-flex h-6 min-h-6 items-stretch overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

/** Główne + Uzupełniające + menu Więcej — prośby handlowców (zwykłe kliknięcie). */
export function IndividualRequestActionBar({
  orderIds,
  supplierId,
  hasInfoViaPanel,
  headline,
  pending,
  scopeKey,
  run,
  onEdit,
  onCancel,
  density = "default",
}: {
  orderIds: string[];
  supplierId: string | null;
  hasInfoViaPanel: boolean;
  headline: string;
  pending: boolean;
  scopeKey: string;
  run: DailyPanelRunFn;
  onEdit: () => void;
  onCancel: () => void;
  /** W bloku wieloosobowym u dostawcy — mniejsze przyciski, etykieta „tylko ta osoba”. */
  density?: "default" | "nested";
}) {
  const disabled = pending || !supplierId;
  const scope = { scope: scopeKey };
  const nested = density === "nested";
  const shellClass = nested ? nestedShellClass : panelActionBarShellClass;
  const primaryClass = nested
    ? nestedPrimarySegmentClass
    : cn(
        buttonGroupItemClass,
        panelSegmentPrimaryClass,
        "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
      );
  const outlineClass = nested
    ? nestedOutlineSegmentClass
    : cn(buttonGroupItemClass, panelSegmentOutlineClass);

  const group = (
    <ButtonGroup
      ariaLabel={
        nested
          ? `Zamówienie tylko dla ${headline}`
          : "Zamówienie i więcej opcji"
      }
      className={shellClass}
      allowOverflow
    >
      <button
        type="button"
        disabled={disabled}
        className={primaryClass}
        onClick={() =>
          run(
            () => actionProcessIndividual(orderIds, "GLOWNE"),
            "Oznaczono jako zamówienie główne",
            "Oznaczanie jako główne…",
            scope
          )
        }
      >
        {hasInfoViaPanel ? "Główne (info)" : "Główne"}
      </button>
      <button
        type="button"
        disabled={disabled}
        className={outlineClass}
        onClick={() =>
          run(
            () => actionProcessIndividual(orderIds, "POBOCZNE"),
            "Oznaczono jako uzupełniające",
            "Oznaczanie jako uzupełniające…",
            scope
          )
        }
      >
        {hasInfoViaPanel ? "Uzupełn." : nested ? "Uzupełn." : "Uzupełniające"}
      </button>
      <RequestGroupOverflowMenu
        headline={headline}
        disabled={pending}
        iconOnly
        className={nested ? "border-0 border-l border-slate-200" : panelSegmentLastClass}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </ButtonGroup>
  );

  if (nested) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-[10px] font-medium text-slate-400">Tylko ta osoba</span>
        {group}
      </div>
    );
  }

  return group;
}
