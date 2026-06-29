"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  panelTypography,
  panelMetricTileClass,
} from "@/lib/ui/ontime-theme";
import {
  WAREHOUSE_SHIPMENT_FORMS,
  type WarehouseShipmentForm,
} from "@/lib/warehouse/delivery-carriers";
import type { UpcomingDeliverySupplier } from "@/lib/data/upcoming-deliveries";
import type { IndividualOrderStatus } from "@/types/database";
import {
  IconChevronRight,
  IconPackage,
  IconTruck,
} from "@/components/icons/StrokeIcons";

function shipmentFormLabel(value: string): string {
  return WAREHOUSE_SHIPMENT_FORMS.find((f) => f.value === value)?.label ?? value;
}

function statusBadgeClass(status: IndividualOrderStatus): string {
  switch (status) {
    case "Zamowione":
      return "bg-sky-50 text-sky-700 ring-1 ring-sky-200/80";
    case "Czesciowo_zrealizowane":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200/80";
    default:
      return "bg-slate-50 text-slate-600 ring-1 ring-slate-200/80";
  }
}

function statusLabel(status: IndividualOrderStatus): string {
  switch (status) {
    case "Zamowione":
      return "Zamówione";
    case "Czesciowo_zrealizowane":
      return "Częściowo";
    default:
      return status;
  }
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={cn(panelMetricTileClass, "border-slate-200/70 bg-slate-50/60 px-2.5 py-2")}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

export function UpcomingDeliverySupplierCard({
  supplier,
}: {
  supplier: UpcomingDeliverySupplier;
}) {
  const [expanded, setExpanded] = useState(false);

  const salesPeopleLabel = supplier.salesPeople
    .slice(0, 3)
    .map((sp) => sp.name)
    .join(", ");
  const extraSalesPeople = supplier.salesPeople.length - 3;

  return (
    <div className="rounded-md border border-slate-200/80 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 px-3 py-3 text-left sm:px-4"
        aria-expanded={expanded}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
          <IconTruck size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className={panelTypography.rowTitle}>{supplier.supplierName}</p>
            {supplier.zdDocNumber ? (
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600">
                {supplier.zdDocNumber}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className={panelTypography.rowMeta}>
              {supplier.positionCount > 0
                ? `${supplier.positionCount} poz. · ${supplier.totalQuantity} szt.`
                : (supplier.zdOnlyDocNumbers?.length ?? 0) > 0
                  ? `${supplier.zdOnlyDocNumbers?.length ?? 0} ZD bez zamówienia`
                  : "brak pozycji"}
            </span>
            {supplier.carrierLabel ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                <IconPackage size={12} />
                {supplier.carrierLabel}
                {supplier.carrierHint
                  ? ` · ${shipmentFormLabel(supplier.carrierHint.shipmentForm as WarehouseShipmentForm)}`
                  : ""}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">brak prognozy kuriera</span>
            )}
          </div>
          {supplier.salesPeople.length > 0 ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              <span className="font-medium text-slate-600">Dla:</span> {salesPeopleLabel}
              {extraSalesPeople > 0 ? ` i ${extraSalesPeople} więcej` : ""}
            </p>
          ) : null}
        </div>
        <IconChevronRight
          size={16}
          className={cn(
            "mt-1 shrink-0 text-slate-400 transition-transform",
            expanded && "rotate-90"
          )}
        />
      </button>

      {expanded ? (
        <div className="border-t border-slate-100 px-3 py-3 sm:px-4">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MiniStat label="Pozycje" value={supplier.positionCount} />
            <MiniStat label="Sztuki" value={supplier.totalQuantity} />
            <MiniStat
              label="Paczki"
              value={supplier.carrierHint?.typicalPackageCount ?? "—"}
            />
            <MiniStat
              label="Palety"
              value={supplier.carrierHint?.typicalPalletCount ?? "—"}
            />
          </div>
          {supplier.totalDelivered > 0 ? (
            <p className="mb-2 text-[11px] font-medium text-emerald-700">
              {supplier.totalDelivered} / {supplier.totalQuantity} szt. już odebranych
            </p>
          ) : null}
          {(supplier.zdOnlyDocNumbers?.length ?? 0) > 0 ? (
            <div className="mb-2 rounded-md bg-slate-50 px-2.5 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                ZD z Subiekta (bez dopasowanego zamówienia)
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(supplier.zdOnlyDocNumbers ?? []).map((nr) => (
                  <span
                    key={nr}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600"
                  >
                    {nr}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <ul className="divide-y divide-slate-100">
            {supplier.orders.map((order) => (
              <li
                key={order.id}
                className="flex items-start gap-2 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-medium text-slate-700">
                      {order.symbol || "—"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        statusBadgeClass(order.status)
                      )}
                    >
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-slate-600">{order.products}</p>
                  {order.sales_person?.name ? (
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {order.sales_person.name}
                    </p>
                  ) : null}
                </div>
                <span className="shrink-0 text-right font-semibold tabular-nums text-slate-900">
                  {order.quantity} szt.
                  {parseInt(order.delivered_quantity || "0", 10) > 0 ? (
                    <span className="block text-[10px] font-normal text-emerald-600">
                      odebrano {order.delivered_quantity}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
