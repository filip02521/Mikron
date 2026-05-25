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
  canCancel: boolean;
  onAssignClient: () => void;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const hasAny = canAssignClient || canEdit || canCancel;
  if (!hasAny) return null;

  const isInformacja = listKind === "informacja";

  return (
    <OverflowMenu
      label={`Opcje — ${supplierName}`}
      disabled={disabled}
      align="end"
      iconOnly
      triggerClassName="h-7 w-7"
    >
      {canAssignClient ? (
        <OverflowMenuItem disabled={disabled} onClick={onAssignClient}>
          {hasClient ? "Zmień klienta" : "Przypisz klienta"}
        </OverflowMenuItem>
      ) : null}
      {canEdit ? (
        <OverflowMenuItem disabled={disabled} onClick={onEdit}>
          {isInformacja ? "Popraw informację" : "Popraw prośbę"}
        </OverflowMenuItem>
      ) : null}
      {canCancel ? (
        <OverflowMenuItem danger disabled={disabled} onClick={onCancel}>
          {isInformacja ? "Anuluj informację" : "Anuluj prośbę"}
        </OverflowMenuItem>
      ) : null}
    </OverflowMenu>
  );
}
