"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { RequestGroupOverflowMenu } from "@/components/summary/RequestGroupOverflowMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import { panelSegmentLastClass, panelSegmentPrimaryClass } from "@/lib/ui/ontime-theme";
import { buttonGroupItemClass, panelActionBarShellClass } from "@/lib/ui/surfaces";
import { actionProcessIndividual } from "@/app/actions/admin";

const outlineSegmentClass = cn(
  "flex h-7 min-h-7 max-h-7 shrink-0 items-center justify-center px-2.5 text-xs font-semibold leading-none",
  "border-0 border-l border-indigo-200/90 bg-[var(--primary-muted)]/60 text-indigo-800",
  "transition-colors duration-150 hover:bg-[var(--primary-muted)] disabled:cursor-not-allowed disabled:opacity-50"
);

const nestedOutlineSegmentClass = cn(
  "flex h-6 min-h-6 max-h-6 shrink-0 items-center justify-center px-2 text-[11px] font-semibold leading-none",
  "border-0 border-l border-slate-200 bg-slate-50 text-slate-700",
  "transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
);

const nestedPrimarySegmentClass = cn(
  "flex h-6 min-h-6 max-h-6 shrink-0 items-center justify-center px-2 text-[11px] font-semibold leading-none",
  "border-0 bg-indigo-600 text-white",
  "transition-colors duration-150 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
);

const nestedShellClass =
  "inline-flex h-6 items-stretch overflow-hidden rounded-md border border-slate-200/90 bg-white shadow-sm";

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
    : cn(buttonGroupItemClass, outlineSegmentClass);

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
        className={cn(nested ? outlineClass : cn(buttonGroupItemClass, outlineSegmentClass))}
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
        className={nested ? "h-6 min-h-6 max-h-6 border-0 border-l border-slate-200" : panelSegmentLastClass}
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
