"use client";

import type { SupplierWithSchedule } from "@/types/database";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import { Badge } from "@/components/ui/Badge";

export function SupplierAdminNameCell({
  supplier: s,
  isEditing,
  onEdit,
  trailingBadge,
  teethLane = false,
}: {
  supplier: SupplierWithSchedule;
  isEditing: boolean;
  onEdit: () => void;
  trailingBadge?: React.ReactNode;
  teethLane?: boolean;
}) {
  const initial = s.name.charAt(0).toUpperCase() || "?";
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edytuj kartę dostawcy ${s.name}`}
      className="group flex min-w-0 items-center gap-2.5 text-left"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-neutral-50 text-sm font-bold text-neutral-700 ring-1 ring-inset ring-neutral-100 transition group-hover:bg-neutral-100 group-hover:text-neutral-800"
        aria-hidden
      >
        {initial}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-900 group-hover:text-neutral-800 group-hover:underline">
            {s.name}
          </span>
          {trailingBadge}
          {!teethLane && isSupplierOrderOnDemand(s) ? (
            <Badge variant="purple" className="text-[10px]">
              Na żądanie
            </Badge>
          ) : null}
          {s.subiekt_kh_id == null ? (
            <Badge variant="warning" className="text-[10px]">
              Bez Subiekta
            </Badge>
          ) : null}
          {isEditing ? (
            <Badge variant="info" className="text-[10px]">
              Edycja
            </Badge>
          ) : null}
        </span>
      </span>
    </button>
  );
}
