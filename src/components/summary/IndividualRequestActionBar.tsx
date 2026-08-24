"use client";

import { ButtonGroup } from "@/components/ui/ButtonGroup";
import {
  RequestGroupOverflowMenu,
  type RequestGroupFlagShortcut,
} from "@/components/summary/RequestGroupOverflowMenu";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import { cn } from "@/lib/cn";
import {
  panelSegmentLastClass,
  panelSegmentOutlineClass,
  panelSegmentPrimaryClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import {
  buttonGroupItemClass,
  panelActionBarFooterShellClass,
  panelActionSegmentClass,
} from "@/lib/ui/surfaces";
import { actionProcessIndividual } from "@/app/actions/admin";
import {
  procurementGlowneButtonLabel,
  procurementGlowneButtonTitle,
} from "@/lib/orders/glowne-action-ui";
import { procurementRequestFooterScopeLabelClass } from "@/components/summary/procurement-request-row-styles";

const footerPrimaryClass = cn(
  buttonGroupItemClass,
  panelSegmentPrimaryClass,
  "min-w-0 flex-1 whitespace-nowrap px-2 text-[12px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
);

const footerOutlineClass = cn(
  buttonGroupItemClass,
  panelSegmentOutlineClass,
  "min-w-0 flex-1 whitespace-nowrap px-2 text-[12px]"
);

function nestedPrimarySegmentClass(tone: DailyPanelUnseenVariant) {
  return cn(
    panelActionSegmentClass,
    "min-w-0 flex-1 whitespace-nowrap px-1.5 text-[11px] font-semibold border-0 text-white",
    "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
    tone === "stockOut"
      ? "bg-amber-600 hover:bg-amber-700"
      : "bg-indigo-600 hover:bg-indigo-700"
  );
}

const nestedOutlineSegmentClass = cn(
  panelActionSegmentClass,
  "min-w-0 flex-1 whitespace-nowrap px-1.5 text-[11px] font-semibold",
  "border-0 border-l border-slate-200 bg-slate-50 text-slate-700",
  "transition-colors duration-150 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
);

function nestedShellClass(tone: DailyPanelUnseenVariant) {
  return cn(
    panelActionBarFooterShellClass,
    tone === "stockOut" ? "border-amber-200/70" : "border-indigo-200/70"
  );
}

/** Główne + Uzupełniające + menu Więcej — prośby handlowców. */
export function IndividualRequestActionBar({
  orderIds,
  supplierId,
  hasInfoViaPanel,
  supplierOrderOnDemand = false,
  headline,
  pending,
  scopeKey,
  run,
  onEdit,
  onCancel,
  onOpenSupplierDetails,
  onSetFlag,
  hasFlag = false,
  currentFlagId = null,
  flagShortcuts,
  onSetFlagShortcut,
  onClearFlag,
  density = "default",
  tone = "prosby",
}: {
  orderIds: string[];
  supplierId: string | null;
  hasInfoViaPanel: boolean;
  supplierOrderOnDemand?: boolean;
  headline: string;
  pending: boolean;
  scopeKey: string;
  run: DailyPanelRunFn;
  onEdit: () => void;
  onCancel: () => void;
  onOpenSupplierDetails?: () => void;
  onSetFlag?: () => void;
  hasFlag?: boolean;
  currentFlagId?: string | null;
  flagShortcuts?: RequestGroupFlagShortcut[];
  onSetFlagShortcut?: (flagId: string) => void;
  onClearFlag?: () => void;
  /** W bloku wieloosobowym u dostawcy — etykieta „tylko ta osoba”. */
  density?: "default" | "nested";
  /** Ton UI — amber w stock-out, indigo w prośbach. */
  tone?: DailyPanelUnseenVariant;
}) {
  const disabled = pending || !supplierId;
  const scope = { scope: scopeKey };
  const nested = density === "nested";

  const shellClass = nested ? nestedShellClass(tone) : panelActionBarFooterShellClass;
  const primaryClass = nested ? nestedPrimarySegmentClass(tone) : footerPrimaryClass;
  const outlineClass = nested ? nestedOutlineSegmentClass : footerOutlineClass;

  const glowneLabel = procurementGlowneButtonLabel({
    hasInfoViaPanel,
    supplierOrderOnDemand,
    compact: nested,
  });
  const glowneTitle = procurementGlowneButtonTitle({
    hasInfoViaPanel,
    supplierOrderOnDemand,
  });
  const uzupelniajaceLabel =
    hasInfoViaPanel || nested ? "Uzupełn." : "Uzupełniające";

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
        title={glowneTitle}
        onClick={() =>
          run(
            () => actionProcessIndividual(orderIds, "GLOWNE"),
            supplierOrderOnDemand
              ? "Oznaczono jako główne (bez terminu planowego)"
              : "Oznaczono jako zamówienie główne",
            "Oznaczanie jako główne…",
            scope
          )
        }
      >
        {glowneLabel}
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
        {uzupelniajaceLabel}
      </button>
      <RequestGroupOverflowMenu
        headline={headline}
        disabled={pending}
        iconOnly
        className={cn(
          nested ? "border-0 border-l border-slate-200" : panelSegmentLastClass,
          "shrink-0"
        )}
        onEdit={onEdit}
        onCancel={onCancel}
        onOpenSupplierDetails={onOpenSupplierDetails}
        onSetFlag={onSetFlag}
        hasFlag={hasFlag}
        currentFlagId={currentFlagId}
        flagShortcuts={flagShortcuts}
        onSetFlagShortcut={onSetFlagShortcut}
        onClearFlag={onClearFlag}
      />
    </ButtonGroup>
  );

  if (nested) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className={procurementRequestFooterScopeLabelClass}>Tylko ta osoba</span>
        <div className="min-w-0 flex-1">{group}</div>
      </div>
    );
  }

  return group;
}
