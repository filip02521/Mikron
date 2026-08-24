"use client";

import { useMemo, useState } from "react";
import { actionProcessIndividual } from "@/app/actions/admin";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import type { DailyPanelRunFn } from "@/components/summary/useDailyPanelRunner";
import {
  collectProcurementSupplierBlockOrderIds,
  procurementBlockGroupCountPhrase,
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
import {
  panelSegmentOutlineClass,
  panelSegmentPrimaryClass,
  type DailyPanelUnseenVariant,
} from "@/lib/ui/ontime-theme";
import { buttonGroupItemClass, panelActionBarFooterShellClass } from "@/lib/ui/surfaces";

function ActionCount({
  n,
  variant,
  tone = "prosby",
}: {
  n: number;
  variant: "primary" | "outline";
  tone?: DailyPanelUnseenVariant;
}) {
  if (n < 2) return null;
  const isStockOut = tone === "stockOut";
  return (
    <span
      className={cn(
        "ml-1 inline-flex min-w-[1.15rem] justify-center rounded px-1 text-[10px] font-bold tabular-nums",
        variant === "primary"
          ? "bg-white/25 text-white ring-1 ring-inset ring-white/35"
          : isStockOut
            ? "bg-amber-600/15 text-amber-950 ring-1 ring-inset ring-amber-300/40"
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
  itemKind = "request",
  tone = "prosby",
}: {
  block: ProcurementSupplierBlock;
  pending: boolean;
  run: DailyPanelRunFn;
  /** Prośby vs sygnały stock-out — copy w modalu i toastach. */
  itemKind?: "request" | "signal";
  tone?: DailyPanelUnseenVariant;
}) {
  const orderIds = useMemo(
    () => collectProcurementSupplierBlockOrderIds(block),
    [block]
  );
  const hasInfoViaPanel = procurementSupplierBlockHasInfoViaPanel(block);
  const groupCount = block.requestGroups.length;
  const groupPhrase = procurementBlockGroupCountPhrase(groupCount, itemKind);
  const scope = { scope: procurementSupplierBlockScopeKey(block.supplierId) };
  const disabled = pending || orderIds.length === 0;
  const isStockOut = tone === "stockOut";
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
    ? procurementSupplierBlockConfirmCopy(block, confirmMode, itemKind)
    : null;

  const runMode = (mode: "GLOWNE" | "POBOCZNE") => {
    setConfirmMode(null);
    run(
      () => actionProcessIndividual(orderIds, mode),
      mode === "GLOWNE"
        ? block.supplierOrderOnDemand
          ? `Oznaczono ${groupPhrase} u ${block.supplierName} jako główne (bez terminu)`
          : `Oznaczono ${groupPhrase} u ${block.supplierName} jako główne`
        : `Oznaczono ${groupPhrase} u ${block.supplierName} jako uzupełniające`,
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
          className={panelActionBarFooterShellClass}
          allowOverflow
        >
          <button
            type="button"
            disabled={disabled}
            className={cn(
              buttonGroupItemClass,
              isStockOut
                ? "bg-amber-600 text-white hover:bg-amber-700"
                : panelSegmentPrimaryClass,
              "min-w-0 flex-1 whitespace-nowrap px-2 text-[12px]",
              "transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            )}
            title={glowneTitle}
            onClick={() => setConfirmMode("GLOWNE")}
          >
            {glowneLabel}
            <ActionCount n={groupCount} variant="primary" tone={tone} />
          </button>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              buttonGroupItemClass,
              panelSegmentOutlineClass,
              "min-w-0 flex-1 whitespace-nowrap px-2 text-[12px]",
              hasInfoViaPanel && "px-1.5",
              isStockOut && "text-amber-950 hover:bg-amber-50"
            )}
            onClick={() => setConfirmMode("POBOCZNE")}
          >
            {hasInfoViaPanel ? "Uzupełn." : "Uzupełniające"}
            <ActionCount n={groupCount} variant="outline" tone={tone} />
          </button>
        </ButtonGroup>
      </div>
    </>
  );
}
