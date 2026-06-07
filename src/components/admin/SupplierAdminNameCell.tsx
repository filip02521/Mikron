"use client";

import type { SupplierWithSchedule } from "@/types/database";
import { isSupplierOrderOnDemand } from "@/lib/orders/supplier-on-demand";
import { Badge } from "@/components/ui/Badge";
import { SupplierSubiektLinkIndicator } from "@/components/admin/SupplierSubiektLinkIndicator";

export function SupplierAdminNameCell({
  supplier: s,
  isEditing,
  onEdit,
  trailingBadge,
}: {
  supplier: SupplierWithSchedule;
  isEditing: boolean;
  onEdit: () => void;
  trailingBadge?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      aria-label={`Edytuj kartę dostawcy ${s.name}`}
      className="group flex min-w-0 flex-wrap items-center gap-2 text-left"
    >
      <SupplierSubiektLinkIndicator
        subiektKhId={s.subiekt_kh_id}
        className="shrink-0 scale-90"
      />
      <span className="font-medium text-slate-900 group-hover:text-indigo-800 group-hover:underline">
        {s.name}
      </span>
      {trailingBadge}
      {isSupplierOrderOnDemand(s) ? (
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
    </button>
  );
}
