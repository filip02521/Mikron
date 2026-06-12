"use client";

import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";
import type { MyOrderListKind } from "@/lib/orders/my-order-row-layout";

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
  canPartialCancelCustom,
  partialCancelCustomLabel,
  onPartialCancelCustom,
  assignClientLabel,
  onAssignClient,
  onEdit,
  onCancel,
}: {
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
  canPartialCancelCustom?: boolean;
  partialCancelCustomLabel?: string;
  onPartialCancelCustom?: () => void;
  /** Np. przy wielu produktach — otwiera listę pozycji. */
  assignClientLabel?: string;
  onAssignClient: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const hasAny =
    canAssignClient ||
    canEdit ||
    canCancel ||
    canPartialCancelRemainder ||
    canPartialCancelCustom;
  if (!hasAny) return null;

  const isInformacja = listKind === "informacja";

  return (
    <OverflowMenu
      label={`Opcje — ${supplierName}`}
      disabled={disabled}
      align="end"
      iconOnly
      triggerClassName="h-10 w-10 sm:h-7 sm:w-7"
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
      {canPartialCancelRemainder && onPartialCancelRemainder ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onPartialCancelRemainder}>
          {partialCancelRemainderLabel ?? "Rezygnuj z reszty"}
        </OverflowMenuItem>
      ) : null}
      {canPartialCancelCustom && onPartialCancelCustom ? (
        <OverflowMenuItem disabled={disabled} onClick={onPartialCancelCustom}>
          {partialCancelCustomLabel ?? "Inna ilość…"}
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
