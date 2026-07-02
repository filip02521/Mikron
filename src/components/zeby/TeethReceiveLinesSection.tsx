"use client";

import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { checkboxBrandClass, controlFocusClass, panelSubsectionInsetClass, panelTypography } from "@/lib/ui/ontime-theme";
import { TEETH_KIND_LABELS } from "@/lib/teeth/teeth-catalog";
import {
  teethReceiveOrderIdsWithSessionInput,
  teethReceiveRowMeta,
  type TeethReceiveFlatRow,
} from "@/lib/teeth/teeth-receive-lines";
import {
  teethReceiveAlreadyDelivered,
  teethReceiveGroupsFromOrder,
  teethReceiveLineAlreadyDelivered,
  teethReceiveLineRemaining,
  teethReceiveRemaining,
} from "@/lib/teeth/teeth-receive-picker";
import {
  teethReceiveDataRowActiveClass,
  teethReceiveDataRowClass,
  teethReceiveDataRowClosedClass,
  teethReceiveDataRowDoneClass,
  teethReceiveDataRowPartialClass,
  teethReceiveManualCellClass,
  teethReceiveQtyInputClass,
  teethReceiveQtyInputDoneClass,
  teethReceiveQtyInputFilledClass,
  teethReceiveSalesPersonBannerClass,
  teethReceiveSalesPersonDotClass,
  teethReceiveSalesPersonRowClass,
  teethReceiveSaveButtonClass,
  teethReceiveSectionOutlineButtonClass,
  teethReceiveTableWrapClass,
  teethReceiveTdClass,
  teethReceiveThClass,
  teethPanelSupplierCardClass,
  teethPanelSupplierHeaderClass,
} from "@/lib/teeth/teeth-panel-ui";
import { queueSupplierLeadingCellClass } from "@/lib/orders/queue-supplier-groups";
import { receiveQueueTargetQuantity } from "@/lib/orders/sales-cancel";
import type { IndividualOrder } from "@/types/database";
import { plPozycja } from "@/lib/ui/polish-plurals";

const JAW_LABELS = { upper: "Góra", lower: "Dół" } as const;
const TABLE_COLS = 6;

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      className={cn(
        "mt-0.5 size-4 shrink-0 text-slate-500 transition-transform duration-200",
        open && "rotate-90",
      )}
      fill="currentColor"
    >
      <path d="M7.2 4.2a1 1 0 0 1 1.4 0l4.8 4.8a1 1 0 0 1 0 1.4l-4.8 4.8a1 1 0 1 1-1.4-1.4L11.58 10 7.2 5.6a1 1 0 0 1 0-1.4Z" />
    </svg>
  );
}

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 10.5 3 3 7-7" />
    </svg>
  );
}

function SalesPersonDivider({
  name,
  lineCount,
  stripeIndex,
  hasPartial,
  onFillAll,
  pending,
}: {
  name: string;
  lineCount: number;
  stripeIndex: number;
  hasPartial: boolean;
  onFillAll?: () => void;
  pending: boolean;
}) {
  return (
    <tr className={teethReceiveSalesPersonRowClass}>
      <td colSpan={TABLE_COLS} className="p-0">
        <div className={teethReceiveSalesPersonBannerClass}>
          <div className="h-px flex-1 bg-slate-200/90" aria-hidden />
          <div className="flex max-w-[min(100%,24rem)] shrink-0 items-center gap-2 rounded-full bg-slate-50/90 px-3 py-1.5 ring-1 ring-slate-200/90">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                teethReceiveSalesPersonDotClass(stripeIndex),
              )}
              aria-hidden
            />
            <span className="truncate text-xs font-semibold text-slate-900">{name}</span>
            <span className="shrink-0 text-[10px] font-medium tabular-nums text-slate-500">
              {lineCount} {plPozycja(lineCount)}
            </span>
            {hasPartial ? (
              <span className="shrink-0 rounded-md bg-amber-100/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                częściowo
              </span>
            ) : null}
            {onFillAll ? (
              <button
                type="button"
                disabled={pending}
                onClick={onFillAll}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-50 hover:text-indigo-900 disabled:opacity-50"
              >
                Całość
              </button>
            ) : null}
          </div>
          <div className="h-px flex-1 bg-slate-200/90" aria-hidden />
        </div>
      </td>
    </tr>
  );
}

function QtyInput({
  value,
  disabled,
  onChange,
  filled,
  done,
  ariaLabel,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  filled: boolean;
  done: boolean;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="0"
      disabled={disabled}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        teethReceiveQtyInputClass,
        controlFocusClass,
        filled && !done && teethReceiveQtyInputFilledClass,
        done && teethReceiveQtyInputDoneClass,
        disabled && "cursor-not-allowed opacity-60",
      )}
    />
  );
}

export function TeethReceiveLinesSection({
  sectionTitle,
  orderIds,
  flatRows,
  receiveQueue,
  isOpen,
  onToggle,
  flatLineQty,
  manualQty,
  pending,
  canPickSpec,
  onSaveFullGroup,
  onSaveWithInput,
  onFillSalesPerson,
  onLineQtyChange,
  onToggleLine,
  onManualQtyChange,
}: {
  sectionTitle: string;
  orderIds: string[];
  flatRows: TeethReceiveFlatRow[];
  receiveQueue: IndividualOrder[];
  isOpen: boolean;
  onToggle: () => void;
  flatLineQty: Record<string, string>;
  manualQty: Record<string, string>;
  pending: boolean;
  canPickSpec: (order: IndividualOrder) => boolean;
  onSaveFullGroup: () => void;
  onSaveWithInput: () => void;
  onFillSalesPerson: (orders: IndividualOrder[]) => void;
  onLineQtyChange: (row: TeethReceiveFlatRow, value: string) => void;
  onToggleLine: (row: TeethReceiveFlatRow, checked: boolean) => void;
  onManualQtyChange: (orderId: string, value: string) => void;
}) {
  const sectionOrders = receiveQueue.filter((order) => orderIds.includes(order.id));
  const orderIdsWithInput = teethReceiveOrderIdsWithSessionInput(
    sectionOrders,
    flatLineQty,
    manualQty,
    canPickSpec,
  );
  const canSaveInput = orderIdsWithInput.length > 0;

  return (
    <section className={teethPanelSupplierCardClass}>
      <div
        className={cn(
          teethPanelSupplierHeaderClass,
          panelSubsectionInsetClass,
          !isOpen && "border-b-0",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md text-left hover:bg-black/[0.03]"
          aria-expanded={isOpen}
        >
          <Chevron open={isOpen} />
          <span
            className={cn(
              panelTypography.sectionTitle,
              canSaveInput && "decoration-indigo-400 decoration-2 underline-offset-2",
              canSaveInput && "underline",
            )}
          >
            {sectionTitle}
          </span>
        </button>
        {isOpen ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {canSaveInput ? (
              <button
                type="button"
                disabled={pending}
                onClick={onSaveWithInput}
                className={cn(teethReceiveSaveButtonClass, "inline-flex items-center gap-1.5")}
              >
                <SaveIcon className="size-3.5" />
                <span className="hidden sm:inline">Zapisz wprowadzone</span>
                <span className="sm:hidden">Zapisz</span>
                <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] tabular-nums">
                  {orderIdsWithInput.length}
                </span>
              </button>
            ) : null}
            {orderIds.length > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={onSaveFullGroup}
                className={teethReceiveSectionOutlineButtonClass}
              >
                Całość sekcji
              </button>
            ) : null}
          </div>
        ) : canSaveInput ? (
          <button
            type="button"
            disabled={pending}
            title="Zapisz wprowadzone ilości"
            onClick={onSaveWithInput}
            className={cn(
              teethReceiveSaveButtonClass,
              "inline-flex size-8 items-center justify-center p-0 sm:size-auto sm:px-3 sm:py-1.5",
            )}
          >
            <SaveIcon className="size-3.5" />
            <span className="hidden sm:ml-1 sm:inline">Zapisz</span>
          </button>
        ) : null}
      </div>

      {isOpen && flatRows.length > 0 ? (
        <div className={cn(teethReceiveTableWrapClass, "border-t border-slate-200/80")}>
          <table className="w-full min-w-[34rem] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200/80">
                <th className={cn(teethReceiveThClass, "text-left")}>Kolor</th>
                <th className={cn(teethReceiveThClass, "text-left")}>Fason</th>
                <th className={cn(teethReceiveThClass, "text-left")}>Szczęka</th>
                <th className={cn(teethReceiveThClass, "text-left")}>Typ</th>
                <th className={cn(teethReceiveThClass, "text-right")}>Zam.</th>
                <th className={cn(teethReceiveThClass, "text-right")}>Przyjęto</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map((row, rowIndex) => {
                const { isNewSalesPerson, salesPersonBlockLength, isLastInSalesPersonBlock } =
                  teethReceiveRowMeta(flatRows, rowIndex);
                const blockHasPartial =
                  isNewSalesPerson &&
                  flatRows
                    .slice(rowIndex, rowIndex + salesPersonBlockLength)
                    .some((blockRow) => blockRow.order.status === "Czesciowo_zrealizowane");
                const groups = teethReceiveGroupsFromOrder(
                  (row.order.teeth_details ?? []).map((d) => ({
                    position: d.position,
                    color: d.color,
                    mould: d.mould,
                    jaw: d.jaw,
                    kind: d.kind,
                  })),
                );
                const orderRemaining = teethReceiveRemaining(row.order, groups);
                const isPartial = row.order.status === "Czesciowo_zrealizowane";
                const isClosed = orderRemaining <= 0;
                const lineTarget = row.kind === "spec" ? Math.max(1, row.group.count) : 0;
                const lineAlready =
                  row.kind === "spec"
                    ? teethReceiveLineAlreadyDelivered(row.order, row.group, groups)
                    : 0;
                const lineRemaining =
                  row.kind === "spec"
                    ? teethReceiveLineRemaining(row.order, row.group, groups)
                    : 0;
                const isLineClosed = row.kind === "spec" ? lineRemaining <= 0 : isClosed;
                const target = receiveQueueTargetQuantity(row.order);
                const orderedStr =
                  target != null ? String(target) : row.order.quantity ?? "0";
                const already = teethReceiveAlreadyDelivered(row.order);

                const sessionQty =
                  row.kind === "spec"
                    ? parseInt(flatLineQty[row.rowKey] ?? "0", 10)
                    : parseInt(manualQty[row.orderId] ?? "0", 10);
                const hasSessionInput = Number.isFinite(sessionQty) && sessionQty > 0;
                const isLineDone =
                  row.kind === "spec" &&
                  hasSessionInput &&
                  lineRemaining > 0 &&
                  sessionQty >= lineRemaining;

                const rowSurfaceClass = cn(
                  teethReceiveDataRowClass,
                  isLineClosed && teethReceiveDataRowClosedClass,
                  !isLineClosed && isPartial && teethReceiveDataRowPartialClass,
                  !isLineClosed && isLineDone && teethReceiveDataRowDoneClass,
                  !isLineClosed && hasSessionInput && !isLineDone && teethReceiveDataRowActiveClass,
                  isLastInSalesPersonBlock && "border-b-slate-200/90",
                );

                const blockRows = isNewSalesPerson
                  ? flatRows.slice(rowIndex, rowIndex + salesPersonBlockLength)
                  : [];
                const blockOrders = isNewSalesPerson
                  ? receiveQueue.filter((order) =>
                      blockRows.some((blockRow) => blockRow.orderId === order.id),
                    )
                  : [];

                return (
                  <Fragment key={row.rowKey}>
                    {isNewSalesPerson ? (
                      <SalesPersonDivider
                        name={row.salesPersonName}
                        lineCount={salesPersonBlockLength}
                        stripeIndex={row.stripeIndex}
                        hasPartial={blockHasPartial}
                        pending={pending}
                        onFillAll={
                          blockOrders.length > 0
                            ? () => onFillSalesPerson(blockOrders)
                            : undefined
                        }
                      />
                    ) : null}

                    <tr className={rowSurfaceClass}>
                      {row.kind === "spec" ? (
                        <>
                          <td
                            className={cn(
                              teethReceiveTdClass,
                              "font-semibold text-slate-900",
                              queueSupplierLeadingCellClass(0, {
                                stripeIndex: row.stripeIndex,
                              }),
                              "border-l-[3px]",
                            )}
                          >
                            {row.group.color || "—"}
                          </td>
                          <td className={cn(teethReceiveTdClass, "font-medium text-slate-800")}>
                            {row.group.mould?.trim() || "—"}
                          </td>
                          <td className={cn(teethReceiveTdClass, "text-slate-700")}>
                            {row.group.jaw === "upper"
                              ? JAW_LABELS.upper
                              : row.group.jaw === "lower"
                                ? JAW_LABELS.lower
                                : "—"}
                          </td>
                          <td className={cn(teethReceiveTdClass, "text-slate-700")}>
                            {row.group.kind ? TEETH_KIND_LABELS[row.group.kind] : "—"}
                          </td>
                          <td
                            className={cn(
                              teethReceiveTdClass,
                              "text-right font-medium tabular-nums text-slate-600",
                            )}
                          >
                            {lineTarget}
                            {lineAlready > 0 ? (
                              <span className={cn(panelTypography.caption, "mt-0.5 block font-normal")}>
                                już {lineAlready}
                              </span>
                            ) : null}
                          </td>
                          <td className={cn(teethReceiveTdClass, "text-right")}>
                            {isLineClosed ? (
                              <span className={panelTypography.caption}>
                                komplet{lineAlready > 0 ? ` · ${lineAlready}/${lineTarget}` : ""}
                              </span>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <label className="inline-flex cursor-pointer items-center">
                                  <input
                                    type="checkbox"
                                    className={cn("size-3.5", checkboxBrandClass)}
                                    checked={isLineDone}
                                    disabled={pending}
                                    aria-label={`Cała linia ${row.group.color}`}
                                    onChange={(e) => onToggleLine(row, e.target.checked)}
                                  />
                                </label>
                                <QtyInput
                                  value={flatLineQty[row.rowKey] ?? ""}
                                  disabled={pending}
                                  filled={hasSessionInput}
                                  done={isLineDone}
                                  ariaLabel={`Przyjęto ${row.group.color}`}
                                  onChange={(value) => onLineQtyChange(row, value)}
                                />
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            colSpan={4}
                            className={cn(teethReceiveTdClass, queueSupplierLeadingCellClass(0, { stripeIndex: row.stripeIndex }), "border-l-[3px]")}
                          >
                            <div className={teethReceiveManualCellClass}>
                              <p className="font-medium text-slate-900">{row.productLabel}</p>
                              <p className="mt-0.5 text-[10px] leading-relaxed text-amber-900/90">
                                {row.incompleteSpec
                                  ? "Lista niekompletna — wpisz łączną ilość w tej sesji"
                                  : "Brak listy zębów — wpisz łączną ilość w tej sesji"}
                              </p>
                            </div>
                          </td>
                          <td
                            className={cn(
                              teethReceiveTdClass,
                              "text-right align-top tabular-nums text-slate-600",
                            )}
                          >
                            <span className="block font-medium">{orderedStr}</span>
                            {already > 0 ? (
                              <span className={cn(panelTypography.caption, "mt-0.5 block")}>
                                już {already}
                              </span>
                            ) : null}
                          </td>
                          <td className={cn(teethReceiveTdClass, "text-right align-top")}>
                            {isClosed ? (
                              <span className={panelTypography.caption}>komplet</span>
                            ) : (
                              <div className="inline-flex items-center justify-end gap-1.5">
                                <label className="inline-flex cursor-pointer items-center">
                                  <input
                                    type="checkbox"
                                    className={cn("size-3.5", checkboxBrandClass)}
                                    checked={hasSessionInput && sessionQty >= orderRemaining}
                                    disabled={pending}
                                    aria-label={`Cała pozycja ${row.productLabel}`}
                                    onChange={(e) =>
                                      onManualQtyChange(
                                        row.orderId,
                                        e.target.checked ? String(orderRemaining) : "",
                                      )
                                    }
                                  />
                                </label>
                                <QtyInput
                                  value={manualQty[row.orderId] ?? ""}
                                  disabled={pending}
                                  filled={hasSessionInput}
                                  done={hasSessionInput && sessionQty >= orderRemaining}
                                  ariaLabel={`Przyjęto ${row.productLabel}`}
                                  onChange={(value) => onManualQtyChange(row.orderId, value)}
                                />
                              </div>
                            )}
                          </td>
                        </>
                      )}
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : isOpen ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">Brak pozycji w tej sekcji.</p>
      ) : null}
    </section>
  );
}
