"use client";

import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import {
  salesCancelLineCustomQtyLabel,
  salesCancelLineRemainderLabel,
  salesCancelLineShortLabel,
  salesCancelQuickActionLabel,
} from "@/lib/orders/sales-cancel";
import { mojeLineCancelMenuTriggerClass } from "@/lib/ui/moje-shipment-row-styles";

export function MyOrderLineCancelMenu({
  product,
  listKind = "zamowienie",
  pending,
  showRemainderCancel,
  partialDefaultQty,
  showSupplierQuickCancel,
  showPartialQtyCancel,
  showFullLineCancel,
  partialCustomDefaultQty,
  cancelLineLabel,
  cancelLineAriaLabel,
  onRunPartialCancel,
  onCancelLine,
  variant = "standalone",
  className,
}: {
  product: string;
  listKind?: "zamowienie" | "informacja";
  pending?: boolean;
  showRemainderCancel: boolean;
  partialDefaultQty: number | null | undefined;
  showSupplierQuickCancel: boolean;
  showPartialQtyCancel: boolean;
  showFullLineCancel: boolean;
  partialCustomDefaultQty: number;
  cancelLineLabel?: string;
  cancelLineAriaLabel?: string;
  onRunPartialCancel: (defaultQty: number) => void;
  onCancelLine?: () => void;
  variant?: "standalone" | "segment";
  className?: string;
}) {
  const hasAny =
    showRemainderCancel ||
    showSupplierQuickCancel ||
    showPartialQtyCancel ||
    showFullLineCancel;
  if (!hasAny) return null;

  return (
    <OverflowMenu
      label={cancelLineAriaLabel ?? `Anulowanie pozycji — ${product}`}
      disabled={pending}
      align="end"
      iconOnly
      variant={variant}
      className={className}
      triggerClassName={
        variant === "segment" ? undefined : mojeLineCancelMenuTriggerClass
      }
    >
      {showRemainderCancel && partialDefaultQty != null ? (
        <OverflowMenuItem
          danger
          disabled={pending}
          onClick={() => onRunPartialCancel(partialDefaultQty)}
        >
          {salesCancelLineRemainderLabel(partialDefaultQty)}
        </OverflowMenuItem>
      ) : null}
      {showSupplierQuickCancel ? (
        <OverflowMenuItem danger disabled={pending} onClick={() => onRunPartialCancel(1)}>
          {salesCancelQuickActionLabel()}
        </OverflowMenuItem>
      ) : null}
      {showPartialQtyCancel ? (
        <OverflowMenuItem
          danger
          disabled={pending}
          onClick={() => onRunPartialCancel(partialCustomDefaultQty)}
        >
          {salesCancelLineCustomQtyLabel()}
        </OverflowMenuItem>
      ) : null}
      {showFullLineCancel && onCancelLine ? (
        <OverflowMenuItem danger disabled={pending} onClick={onCancelLine}>
          {cancelLineLabel ?? salesCancelLineShortLabel(listKind)}
        </OverflowMenuItem>
      ) : null}
    </OverflowMenu>
  );
}
