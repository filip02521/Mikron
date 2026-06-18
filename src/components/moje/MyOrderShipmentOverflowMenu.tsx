"use client";

import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";

export type MyOrderShipmentOverflowMenuProps = {
  supplierName: string;
  listKind: MyOrderListKind;
  disabled?: boolean;
  hasClient: boolean;
  canAssignClient: boolean;
  canEdit: boolean;
  /** Pełna rezygnacja / anulowanie prośby. */
  canCancel: boolean;
  /** Np. „Anuluj wszystkie pozycje (2 pozycje)” przy grupie. */
  cancelLabel?: string;
  /** Częściowa rezygnacja z reszty u dostawcy (np. 3 z 5 szt.). */
  canPartialCancelRemainder?: boolean;
  partialCancelRemainderLabel?: string;
  onPartialCancelRemainder?: () => void;
  /** Jedna szt. u dostawcy po częściowej dostawie — skrót „Zmień ilość”. */
  canPartialCancelQuick?: boolean;
  partialCancelQuickLabel?: string;
  onPartialCancelQuick?: () => void;
  canPartialCancelCustom?: boolean;
  partialCancelCustomLabel?: string;
  onPartialCancelCustom?: () => void;
  /** Np. przy wielu produktach — otwiera listę pozycji. */
  assignClientLabel?: string;
  onAssignClient: () => void;
  onEdit: () => void;
  onCancel: () => void;
  variant?: "standalone" | "segment";
  className?: string;
  triggerClassName?: string;
};

export function MyOrderShipmentOverflowMenu({
  supplierName,
  listKind,
  disabled,
  hasClient,
  canAssignClient,
  canEdit,
  canCancel,
  cancelLabel,
  canPartialCancelRemainder,
  partialCancelRemainderLabel,
  onPartialCancelRemainder,
  canPartialCancelQuick,
  partialCancelQuickLabel,
  onPartialCancelQuick,
  canPartialCancelCustom,
  partialCancelCustomLabel,
  onPartialCancelCustom,
  assignClientLabel,
  onAssignClient,
  onEdit,
  onCancel,
  variant = "standalone",
  className,
  triggerClassName,
}: MyOrderShipmentOverflowMenuProps) {
  const hasAny =
    canAssignClient ||
    canEdit ||
    canCancel ||
    canPartialCancelRemainder ||
    canPartialCancelQuick ||
    canPartialCancelCustom;
  if (!hasAny) return null;

  const isInformacja = listKind === "informacja";

  return (
    <OverflowMenu
      label={`Opcje — ${supplierName}`}
      disabled={disabled}
      align="end"
      iconOnly
      variant={variant}
      className={className}
      triggerClassName={triggerClassName}
    >
      {canAssignClient ? (
        <OverflowMenuItem disabled={disabled} onClick={onAssignClient}>
          {assignClientLabel ??
            (hasClient ? "Zmień klienta" : "Przypisz klienta")}
        </OverflowMenuItem>
      ) : null}
      {canEdit ? (
        <OverflowMenuItem disabled={disabled} onClick={onEdit}>
          {isInformacja ? "Popraw informację" : "Popraw prośbę"}
        </OverflowMenuItem>
      ) : null}
      {canPartialCancelQuick && onPartialCancelQuick ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onPartialCancelQuick}>
          {partialCancelQuickLabel ?? "Zmień ilość"}
        </OverflowMenuItem>
      ) : null}
      {canPartialCancelRemainder && onPartialCancelRemainder ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onPartialCancelRemainder}>
          {partialCancelRemainderLabel ?? "Zmień ilość"}
        </OverflowMenuItem>
      ) : null}
      {canPartialCancelCustom && onPartialCancelCustom ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onPartialCancelCustom}>
          {partialCancelCustomLabel ?? "Zmień ilość"}
        </OverflowMenuItem>
      ) : null}
      {canCancel ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onCancel}>
          {cancelLabel ?? (isInformacja ? "Anuluj informację" : "Anuluj prośbę")}
        </OverflowMenuItem>
      ) : null}
    </OverflowMenu>
  );
}
