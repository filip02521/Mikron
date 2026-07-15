"use client";

import type { SupplierWithSchedule } from "@/types/database";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

export function SupplierAdminRowMenu({
  supplier,
  allowDelete,
  disabled,
  teethLane = false,
  onEdit,
  onDeactivate,
  onDelete,
  onRemoveFromTeeth,
}: {
  supplier: SupplierWithSchedule;
  allowDelete: boolean;
  disabled?: boolean;
  teethLane?: boolean;
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onRemoveFromTeeth: () => void;
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
      {teethLane ? (
        <OverflowMenuItem danger onClick={onRemoveFromTeeth}>
          Usuń z toru zębów
        </OverflowMenuItem>
      ) : (
        <>
          <OverflowMenuItem onClick={onDeactivate}>Dezaktywuj</OverflowMenuItem>
          {allowDelete ? (
            <OverflowMenuItem danger onClick={onDelete}>
              Usuń rekord
            </OverflowMenuItem>
          ) : null}
        </>
      )}
    </OverflowMenu>
  );
}
