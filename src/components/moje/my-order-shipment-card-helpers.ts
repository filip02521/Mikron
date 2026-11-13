import type { MyOrderRow, MyOrderLine } from "@/lib/orders/my-order-presenter";
import type { SalesCancelPhase } from "@/lib/orders/sales-cancel";
import type { MyOrderShipmentOverflowMenuProps } from "@/components/moje/MyOrderShipmentOverflowMenu";
import {
  salesCancelOverflowLabel,
  salesCancelSoleOverflowFullLabel,
  salesCancelQuickActionLabel,
  salesCancelLineRemainderLabel,
  salesCancelLineCustomQtyLabel,
} from "@/lib/orders/sales-cancel";
import { cn } from "@/lib/cn";

type HeadlineTone = "neutral" | "action" | "warning" | "dismiss" | "stock" | "info" | "informacja" | "success";

export function buildHeadlineClass(
  headlineTone: HeadlineTone,
  isAction: boolean,
  isInformacjaAck: boolean,
  isDismiss: boolean,
  isUrgent: boolean,
  isStock: boolean,
  isInformacja: boolean,
): string {
  // Jeden stan wiersza jako płaska odznaka (DESIGN.md → Chips): kolor tylko, gdy stan coś znaczy.
  // Wiersze wymagające reakcji mają tło stanu, więc ich odznaka jest o stopień mocniejsza.
  const tone = isAction
    ? "bg-emerald-100 text-emerald-900"
    : isDismiss
      ? "bg-red-100 text-red-800"
      : isInformacjaAck
        ? "bg-indigo-100 text-indigo-900"
        : isUrgent
          ? "bg-amber-50 text-amber-900"
          : isInformacja || headlineTone === "info"
            ? "bg-indigo-50 text-indigo-800"
            : "bg-slate-100 text-slate-700";
  return cn(
    "block w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-xs font-medium",
    isStock && !isAction && !isDismiss && !isInformacjaAck && !isUrgent
      ? "bg-slate-100 text-slate-700"
      : tone,
  );
}

type OverflowMenuArgs = {
  row: MyOrderRow;
  canAcknowledge: boolean;
  tourPreview: boolean;
  pending: boolean;
  canEditClient: boolean;
  showEditLink: boolean;
  showSalesCancelLink: boolean;
  soleLine: MyOrderLine | undefined;
  soleOverflowRemainder: boolean;
  soleOverflowQuick: boolean;
  soleOverflowCustom: boolean;
  soleOverflowFull: boolean;
  onEditRequest?: (row: MyOrderRow) => void;
  onCancelRequest?: (orderIds: string[], lines: { product: string; phase: SalesCancelPhase }[]) => void;
  handleAssignClient: () => void;
  openPartialCancel: (line: MyOrderLine, defaultQty: number) => void;
  partialCustomDefaultQty: (line: MyOrderLine) => number;
};

export function buildOverflowMenuProps({
  row,
  canAcknowledge,
  tourPreview,
  pending,
  canEditClient,
  showEditLink,
  showSalesCancelLink,
  soleLine,
  soleOverflowRemainder,
  soleOverflowQuick,
  soleOverflowCustom,
  soleOverflowFull,
  onEditRequest,
  onCancelRequest,
  handleAssignClient,
  openPartialCancel,
  partialCustomDefaultQty,
}: OverflowMenuArgs): Omit<
  MyOrderShipmentOverflowMenuProps,
  "variant" | "className" | "triggerClassName"
> | null {
  if (!canAcknowledge || tourPreview) return null;

  const hasClient = Boolean(row.clientLabel || row.lines.some((l) => l.clientName?.trim()));
  const unassignedLineCount = row.lines.filter((l) => !l.clientName?.trim()).length;
  const assignClientLabel =
    row.lineCount > 1
      ? unassignedLineCount > 0
        ? "Przypisz klientów przy produktach"
        : "Klienci przy produktach"
      : undefined;
  const cancelOverflowLabel = salesCancelOverflowLabel(row.kind, row.salesCancelOrderIds.length);
  const soleOverflowCancelLabel =
    soleLine != null ? salesCancelSoleOverflowFullLabel(row.kind) : undefined;

  return {
    supplierName: row.supplierName,
    listKind: row.kind,
    disabled: pending,
    hasClient,
    canAssignClient: canEditClient && row.lineCount > 0,
    assignClientLabel,
    canEdit: Boolean(showEditLink),
    canCancel: row.lineCount > 1 ? Boolean(showSalesCancelLink) : soleOverflowFull,
    cancelLabel: row.lineCount > 1 ? cancelOverflowLabel : soleOverflowCancelLabel,
    canPartialCancelQuick: soleOverflowQuick,
    partialCancelQuickLabel: soleLine ? salesCancelQuickActionLabel() : undefined,
    onPartialCancelQuick:
      soleLine && soleOverflowQuick
        ? () => openPartialCancel(soleLine, 1)
        : undefined,
    canPartialCancelRemainder: soleOverflowRemainder,
    partialCancelRemainderLabel:
      soleLine?.defaultSalesCancelQuantity != null
        ? salesCancelLineRemainderLabel(soleLine.defaultSalesCancelQuantity)
        : undefined,
    onPartialCancelRemainder:
      soleLine && soleOverflowRemainder
        ? () => openPartialCancel(soleLine, soleLine.defaultSalesCancelQuantity!)
        : undefined,
    canPartialCancelCustom: soleOverflowCustom,
    partialCancelCustomLabel: salesCancelLineCustomQtyLabel(),
    onPartialCancelCustom:
      soleLine && soleOverflowCustom
        ? () => openPartialCancel(soleLine, partialCustomDefaultQty(soleLine))
        : undefined,
    onAssignClient: handleAssignClient,
    onEdit: () => onEditRequest?.(row),
    onCancel: () => {
      const cancellableLines = row.lines
        .filter((l) => row.salesCancelOrderIds.includes(l.id) && l.salesCancelPhase)
        .map((l) => ({ product: l.product, phase: l.salesCancelPhase! }));
      onCancelRequest?.(row.salesCancelOrderIds, cancellableLines);
    },
  };
}

/** „Rozwiń / Zwiń wszystkie”: gdy wszystkie są rozwinięte, zwija; inaczej rozwija wszystkie. */
export function toggleAllExpandedIds(prev: ReadonlySet<string>, ids: readonly string[]): Set<string> {
  const allOpen = ids.length > 0 && ids.every((id) => prev.has(id));
  return allOpen ? new Set() : new Set(ids);
}
