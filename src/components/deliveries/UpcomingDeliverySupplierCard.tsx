"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  panelTypography,
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
  IconCircleCheck,
  IconClock,
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
    case "Zrealizowane":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80";
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
    case "Zrealizowane":
      return "Zrealizowane";
    default:
      return status;
  }
}

function MiniStat({ label, value, compact = false }: { label: string; value: string | number; compact?: boolean }) {
  return (
    <div className={cn(
      "rounded-lg border border-slate-200/70 bg-slate-50/80 text-left shadow-[var(--shadow-card)]",
      compact ? "px-2 py-1.5" : "px-2.5 py-2"
    )}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

type DeliveryStatus = "received" | "partial" | "pending";

function getDeliveryStatus(totalDelivered: number, totalQuantity: number): DeliveryStatus {
  if (totalDelivered <= 0) return "pending";
  if (totalDelivered >= totalQuantity && totalQuantity > 0) return "received";
  return "partial";
}

function statusBadge(status: DeliveryStatus): { label: string; className: string } {
  switch (status) {
    case "received":
      return { label: "Przyjęte", className: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80" };
    case "partial":
      return { label: "Częściowo", className: "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80" };
    default:
      return { label: "Oczekuje", className: "bg-sky-100 text-sky-700 ring-1 ring-sky-200/80" };
  }
}

function statusIcon(status: DeliveryStatus, size: number) {
  switch (status) {
    case "received":
      return <IconCircleCheck size={size} />;
    case "partial":
      return <IconClock size={size} />;
    default:
      return <IconTruck size={size} />;
  }
}

function statusIconColor(status: DeliveryStatus): string {
  switch (status) {
    case "received":
      return "bg-emerald-100 text-emerald-700";
    case "partial":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-sky-100 text-sky-700";
  }
}

function statusProgressBar(status: DeliveryStatus): string {
  switch (status) {
    case "received":
      return "bg-emerald-500";
    case "partial":
      return "bg-amber-500";
    default:
      return "bg-sky-400";
  }
}

function statusProgressTrack(status: DeliveryStatus): string {
  switch (status) {
    case "received":
      return "bg-emerald-100";
    case "partial":
      return "bg-amber-100";
    default:
      return "bg-sky-100";
  }
}

function cardBorder(status: DeliveryStatus): string {
  switch (status) {
    case "received":
      return "border-emerald-200/80 bg-emerald-50/20";
    case "partial":
      return "border-amber-200/80 bg-amber-50/15";
    default:
      return "border-slate-200/80 bg-white";
  }
}

export function UpcomingDeliverySupplierCard({
  supplier,
  compact = false,
}: {
  supplier: UpcomingDeliverySupplier;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const salesPeopleLabel = supplier.salesPeople
    .slice(0, 3)
    .map((sp) => sp.name)
    .join(", ");
  const extraSalesPeople = supplier.salesPeople.length - 3;

  const deliveryStatus = getDeliveryStatus(supplier.totalDelivered, supplier.totalQuantity);
  const deliveryProgress =
    supplier.totalQuantity > 0 && supplier.totalDelivered > 0
      ? Math.min(100, Math.round((supplier.totalDelivered / supplier.totalQuantity) * 100))
      : 0;
  const badge = statusBadge(deliveryStatus);

  return (
    <div className={cn(
      "rounded-lg border shadow-sm transition hover:shadow-md",
      cardBorder(deliveryStatus)
    )}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-start gap-2.5 text-left",
          compact ? "px-2.5 py-2" : "px-3 py-3 sm:px-4"
        )}
        aria-expanded={expanded}
      >
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg",
            statusIconColor(deliveryStatus),
            compact ? "h-7 w-7" : "h-8 w-8"
          )}
        >
          {statusIcon(deliveryStatus, compact ? 14 : 16)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className={cn(panelTypography.rowTitle, "min-w-0 truncate", compact && "text-xs", deliveryStatus === "received" && "text-slate-500 line-through decoration-slate-400/60")}>{supplier.supplierName}</p>
            <span className={cn("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", badge.className)}>
              {badge.label}
            </span>
          </div>
          <div className={cn("mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5", compact && "mt-0.5")}>
            {supplier.zdDocNumber ? (
              <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 ring-1 ring-inset ring-slate-200/50">
                {supplier.zdDocNumber}
              </span>
            ) : null}
            <span className={panelTypography.rowMeta}>
              {supplier.positionCount > 0
                ? `${supplier.positionCount} poz. · ${supplier.totalQuantity} szt.`
                : (supplier.zdOnlyDocNumbers?.length ?? 0) > 0
                  ? `${supplier.zdOnlyDocNumbers?.length ?? 0} ZD bez zamówienia`
                  : "brak pozycji"}
            </span>
            {supplier.carrierLabel ? (
              <span className={cn("inline-flex items-center gap-1 font-medium text-slate-600", compact ? "text-[10px]" : "text-[11px]")}>
                <IconPackage size={compact ? 11 : 12} />
                {supplier.carrierLabel}
                {supplier.carrierHint
                  ? ` · ${shipmentFormLabel(supplier.carrierHint.shipmentForm as WarehouseShipmentForm)}`
                  : ""}
              </span>
            ) : (
              <span className={cn("text-slate-400", compact ? "text-[10px]" : "text-[11px]")}>brak prognozy kuriera</span>
            )}
          </div>
          {supplier.salesPeople.length > 0 && !compact ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              <span className="font-medium text-slate-600">Dla:</span> {salesPeopleLabel}
              {extraSalesPeople > 0 ? ` i ${extraSalesPeople} więcej` : ""}
            </p>
          ) : null}
        </div>
        <IconChevronRight
          size={16}
          className={cn(
            "mt-1 shrink-0 rounded-lg p-0.5 text-slate-400 transition-all hover:bg-slate-100",
            expanded && "rotate-90"
          )}
        />
      </button>

      {deliveryProgress > 0 && !expanded ? (
        <div className={cn(compact ? "px-2.5 pb-1.5" : "px-3 pb-2 sm:px-4")}>
          <div className={cn("h-1 overflow-hidden rounded-full", statusProgressTrack(deliveryStatus))}>
            <div
              className={cn("h-1 rounded-full transition-all", statusProgressBar(deliveryStatus))}
              style={{ width: `${deliveryProgress}%` }}
            />
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div className={cn("border-t border-slate-100", compact ? "px-2.5 py-2.5" : "px-3 py-3 sm:px-4")}>
          <div className={cn("mb-3 grid gap-2", compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
            <MiniStat label="Pozycje" value={supplier.positionCount} compact={compact} />
            <MiniStat label="Sztuki" value={supplier.totalQuantity} compact={compact} />
            <MiniStat
              label="Paczki"
              value={supplier.carrierHint?.typicalPackageCount ?? "—"}
              compact={compact}
            />
            <MiniStat
              label="Palety"
              value={supplier.carrierHint?.typicalPalletCount ?? "—"}
              compact={compact}
            />
          </div>
          {deliveryProgress > 0 ? (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between">
                <p className={cn("text-[11px] font-medium", deliveryStatus === "received" ? "text-emerald-700" : "text-amber-700")}>
                  {supplier.totalDelivered} / {supplier.totalQuantity} szt. odebranych
                </p>
                <span className={cn("text-[11px] font-semibold tabular-nums", deliveryStatus === "received" ? "text-emerald-700" : "text-amber-700")}>
                  {deliveryProgress}%
                </span>
              </div>
              <div className={cn("h-1.5 overflow-hidden rounded-full", statusProgressTrack(deliveryStatus))}>
                <div
                  className={cn("h-1.5 rounded-full transition-all", statusProgressBar(deliveryStatus))}
                  style={{ width: `${deliveryProgress}%` }}
                />
              </div>
            </div>
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
            {supplier.orders.map((order) => {
              const orderDelivered = parseInt(order.delivered_quantity || "0", 10);
              const orderQty = parseInt(order.quantity || "0", 10);
              const orderComplete = orderDelivered > 0 && orderQty > 0 && orderDelivered >= orderQty;
              const orderPartial = orderDelivered > 0 && (!orderQty || orderDelivered < orderQty);
              return (
                <li
                  key={order.id}
                  className={cn(
                    "flex items-start gap-2 py-2 text-xs",
                    compact && "py-1.5",
                    orderComplete && "opacity-60"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("font-mono text-[11px] font-medium", orderComplete ? "text-slate-500 line-through" : "text-slate-700")}>
                        {order.symbol || "—"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          orderComplete
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80"
                            : orderPartial
                              ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80"
                              : statusBadgeClass(order.status)
                        )}
                      >
                        {orderComplete ? "Odebrane" : orderPartial ? `${orderDelivered}/${orderQty}` : statusLabel(order.status)}
                      </span>
                    </div>
                    <p className={cn("mt-0.5 truncate", orderComplete ? "text-slate-400 line-through" : "text-slate-600")}>{order.products}</p>
                    {order.sales_person?.name ? (
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        {order.sales_person.name}
                      </p>
                    ) : null}
                  </div>
                  <span className={cn("shrink-0 text-right font-semibold tabular-nums", compact && "text-[11px]", orderComplete ? "text-slate-500" : "text-slate-900")}>
                    {order.quantity} szt.
                    {orderPartial ? (
                      <span className="block text-[10px] font-normal text-amber-600">
                        odebrano {order.delivered_quantity}
                      </span>
                    ) : orderComplete ? (
                      <span className="block text-[10px] font-normal text-emerald-600">
                        ✓ {order.delivered_quantity}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
