"use client";

import type { SupplierWithSchedule } from "@/types/database";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

export function SupplierAdminRowMenu({
  supplier,
  allowDelete,
  disabled,
  onEdit,
  onDeactivate,
  onDelete,
}: {
  supplier: SupplierWithSchedule;
  allowDelete: boolean;
  disabled?: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <OverflowMenu
      label={`Akcje: ${supplier.name}`}
      align="end"
      disabled={disabled}
      iconOnly
      variant="segment"
    >
      <OverflowMenuItem onClick={onEdit}>Edytuj kartę</OverflowMenuItem>
      <OverflowMenuItem onClick={onDeactivate}>Dezaktywuj</OverflowMenuItem>
      {allowDelete ? (
        <OverflowMenuItem danger onClick={onDelete}>
          Usuń rekord
        </OverflowMenuItem>
      ) : null}
    </OverflowMenu>
  );
}
