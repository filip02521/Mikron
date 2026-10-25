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
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edytuj kartę dostawcy ${s.name}`}
      className="group flex min-h-8 min-w-0 items-center text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-slate-900 group-hover:text-indigo-800 group-hover:underline">
            {s.name}
          </span>
          {trailingBadge}
          {!teethLane && isSupplierOrderOnDemand(s) ? (
            <Badge variant="info" className="text-[0.625rem]">
              Na żądanie
            </Badge>
          ) : null}
          {s.subiekt_kh_id == null ? (
            <Badge variant="warning" className="text-[0.625rem]">
              Bez Subiekta
            </Badge>
          ) : null}
          {isEditing ? (
            <Badge variant="info" className="text-[0.625rem]">
              Edycja
            </Badge>
          ) : null}
        </span>
      </span>
    </button>
  );
}
