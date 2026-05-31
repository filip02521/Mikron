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

/** Główne + Uzupełniające + ⋮ — prośby handlowców (zwykłe kliknięcie). */
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
}) {
  const disabled = pending || !supplierId;
  const scope = { scope: scopeKey };

  return (
    <ButtonGroup ariaLabel="Zamówienie i więcej opcji" className={panelActionBarShellClass} allowOverflow>
      <button
        type="button"
        disabled={disabled}
        className={cn(
          buttonGroupItemClass,
          panelSegmentPrimaryClass,
          "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        )}
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
        className={cn(buttonGroupItemClass, outlineSegmentClass)}
        onClick={() =>
          run(
            () => actionProcessIndividual(orderIds, "POBOCZNE"),
            "Oznaczono jako uzupełniające",
            "Oznaczanie jako uzupełniające…",
            scope
          )
        }
      >
        {hasInfoViaPanel ? "Uzupełn. (info)" : "Uzupełniające"}
      </button>
      <RequestGroupOverflowMenu
        headline={headline}
        disabled={pending}
        iconOnly
        className={panelSegmentLastClass}
        onEdit={onEdit}
        onCancel={onCancel}
      />
    </ButtonGroup>
  );
}
