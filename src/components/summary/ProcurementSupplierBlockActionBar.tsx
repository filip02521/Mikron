"use client";

import { useMemo, useState } from "react";
import { actionProcessIndividual } from "@/app/actions/admin";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import {
  collectProcurementSupplierBlockOrderIds,
  procurementSupplierBlockConfirmCopy,
  procurementSupplierBlockHasInfoViaPanel,
  procurementSupplierBlockScopeKey,
  type ProcurementSupplierBlock,
} from "@/lib/orders/procurement-supplier-groups";
import {
  procurementGlowneButtonLabel,
  procurementGlowneButtonTitle,
} from "@/lib/orders/glowne-action-ui";
import { cn } from "@/lib/cn";
import { panelSegmentOutlineClass, panelSegmentPrimaryClass } from "@/lib/ui/ontime-theme";
import { buttonGroupItemClass, panelActionBarShellClass } from "@/lib/ui/surfaces";

function ActionCount({ n, variant }: { n: number; variant: "primary" | "outline" }) {
  if (n < 2) return null;
  return (
    <span
      className={cn(
        "ml-1 inline-flex min-w-[1.15rem] justify-center rounded px-1 text-[10px] font-bold tabular-nums",
        variant === "primary"
          ? "bg-white/25 text-white ring-1 ring-inset ring-white/35"
          : "bg-indigo-600/15 text-indigo-900 ring-1 ring-inset ring-indigo-300/40"
      )}
    >
      {n}
    </span>
  );
}

export function ProcurementSupplierBlockActionBar({
  block,
  pending,
  run,
}: {
  block: ProcurementSupplierBlock;
  pending: boolean;
  run: DailyPanelRunFn;
}) {
  const orderIds = useMemo(
    () => collectProcurementSupplierBlockOrderIds(block),
    [block]
  );
  const hasInfoViaPanel = procurementSupplierBlockHasInfoViaPanel(block);
  const groupCount = block.requestGroups.length;
  const scope = { scope: procurementSupplierBlockScopeKey(block.supplierId) };
  const disabled = pending || orderIds.length === 0;
  const glowneLabel = procurementGlowneButtonLabel({
    hasInfoViaPanel,
    supplierOrderOnDemand: block.supplierOrderOnDemand,
  });
  const glowneTitle = procurementGlowneButtonTitle({
    hasInfoViaPanel,
    supplierOrderOnDemand: block.supplierOrderOnDemand,
  });

  const [confirmMode, setConfirmMode] = useState<"GLOWNE" | "POBOCZNE" | null>(null);
  const confirmCopy = confirmMode
    ? procurementSupplierBlockConfirmCopy(block, confirmMode)
    : null;

  const runMode = (mode: "GLOWNE" | "POBOCZNE") => {
    setConfirmMode(null);
    run(
      () => actionProcessIndividual(orderIds, mode),
      mode === "GLOWNE"
        ? block.supplierOrderOnDemand
          ? `Oznaczono ${groupCount} ${groupCount === 1 ? "prośbę" : "prośby"} u ${block.supplierName} jako główne (bez terminu)`
          : `Oznaczono ${groupCount} ${groupCount === 1 ? "prośbę" : "prośby"} u ${block.supplierName} jako główne`
        : `Oznaczono ${groupCount} ${groupCount === 1 ? "prośbę" : "prośby"} u ${block.supplierName} jako uzupełniające`,
      mode === "GLOWNE"
        ? "Oznaczanie wszystkich jako główne…"
        : "Oznaczanie wszystkich jako uzupełniające…",
      scope
    );
  };

  return (
    <>
      {confirmCopy ? (
        <ModalShell
          open={confirmMode !== null}
          onClose={() => !pending && setConfirmMode(null)}
          title={confirmCopy.title}
          titleId="prosba-block-confirm-title"
          role="alertdialog"
          size="sm"
          tier="raised"
          disableBackdropClose={pending}
          loadingMessage={pending ? "Przetwarzanie…" : null}
          bodyClassName="px-5 py-4 sm:px-6"
          footer={
            <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => setConfirmMode(null)}
                disabled={pending}
              >
                Anuluj
              </Button>
              <Button
                variant="primary"
                className="min-h-11 w-full sm:w-auto"
                onClick={() => confirmMode && runMode(confirmMode)}
                disabled={pending}
              >
                {confirmCopy.confirmLabel}
              </Button>
            </div>
          }
        >
          <p className="text-sm leading-relaxed text-slate-600">{confirmCopy.message}</p>
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-800">
            {confirmCopy.people.map((name, i) => (
              <li key={`${name}-${i}`} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-indigo-500" aria-hidden />
                {name}
              </li>
            ))}
          </ul>
        </ModalShell>
      ) : null}

      <div
        className={cn(pending && "opacity-60")}
        role="group"
        aria-label={`Zamów razem u ${block.supplierName} — ${groupCount} ${groupCount === 1 ? "osoba" : groupCount < 5 ? "osoby" : "osób"}`}
      >
        <ButtonGroup
          ariaLabel={`Główne lub uzupełniające — wszystkie grupy, ${block.supplierName}`}
          className={cn(panelActionBarShellClass, "w-full shrink-0 sm:w-auto")}
          allowOverflow
        >
          <button
            type="button"
            disabled={disabled}
            className={cn(
              buttonGroupItemClass,
              panelSegmentPrimaryClass,
              "min-w-0 flex-1 px-2.5 sm:flex-none",
              "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            )}
            title={glowneTitle}
            onClick={() => setConfirmMode("GLOWNE")}
          >
            {glowneLabel}
            <ActionCount n={groupCount} variant="primary" />
          </button>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              buttonGroupItemClass,
              panelSegmentOutlineClass,
              "min-w-0 flex-1 px-2 sm:flex-none",
              hasInfoViaPanel && "px-1.5"
            )}
            onClick={() => setConfirmMode("POBOCZNE")}
          >
            {hasInfoViaPanel ? "Uzupełn." : "Uzupełniające"}
            <ActionCount n={groupCount} variant="outline" />
          </button>
        </ButtonGroup>
      </div>
    </>
  );
}
