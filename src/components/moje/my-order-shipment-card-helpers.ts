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
import { salesTypography } from "@/lib/ui/ontime-theme";

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
  return cn(
    salesTypography.rowBody,
    "truncate",
    isAction && "text-emerald-800",
    isInformacjaAck && "font-medium text-violet-900",
    isDismiss && "font-semibold text-rose-950",
    isUrgent && "text-amber-900",
    isStock && "text-sky-900",
    isInformacja &&
      !isAction &&
      !isInformacjaAck &&
      !isUrgent &&
      !isStock &&
      !isDismiss &&
      "font-medium text-violet-900",
    headlineTone === "info" &&
      !isAction &&
      !isUrgent &&
      !isStock &&
      !isInformacja &&
      !isDismiss &&
      "text-indigo-800",
    !isAction &&
      !isUrgent &&
      !isStock &&
      headlineTone !== "info" &&
      !isInformacja &&
      !isDismiss &&
      "text-slate-600",
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
