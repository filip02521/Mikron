"use client";

import { useRouter } from "next/navigation";
import type { SupplierLocation, SupplierWithSchedule } from "@/types/database";
import { OverflowMenu, OverflowMenuItem } from "@/components/ui/OverflowMenu";

function scheduleHref(location: SupplierLocation, name: string): string {
  return `/lokalizacje/${location}?q=${encodeURIComponent(name)}`;
}

export function InactiveSupplierRowMenu({
  supplier,
  disabled,
  onEdit,
  onReactivate,
}: {
  supplier: SupplierWithSchedule;
  disabled?: boolean;
  onEdit: () => void;
  onReactivate: () => void;
}) {
  const router = useRouter();

  return (
    <OverflowMenu
      label={`Akcje: ${supplier.name}`}
      align="end"
      disabled={disabled}
      iconOnly
      variant="segment"
    >
      <OverflowMenuItem onClick={onEdit}>Edytuj kartę</OverflowMenuItem>
      <OverflowMenuItem
        onClick={() => router.push(scheduleHref(supplier.location, supplier.name))}
      >
        Terminy w cyklu
      </OverflowMenuItem>
      <OverflowMenuItem onClick={onReactivate}>Przywróć aktywność</OverflowMenuItem>
    </OverflowMenu>
  );
}
