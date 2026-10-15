"use client";

import { MyOrderAckButton } from "@/components/moje/MyOrderAckButton";
import { cn } from "@/lib/cn";
import type { ZdFulfillmentDeadlineChangeDisplay } from "@/lib/orders/zd-fulfillment-deadline-change";
import { salesTypography } from "@/lib/ui/ontime-theme";

/** Zmieniony termin z ZD przy prośbie — handlowiec potwierdza, że wie (np. uprzedził klienta). */
export function MyOrderZdDeadlineChangeAck({
  change,
  pending,
  onAcknowledge,
}: {
  change: ZdFulfillmentDeadlineChangeDisplay;
  pending: boolean;
  onAcknowledge: () => void;
}) {
  const postponed = change.variant === "postponed";
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg px-3 py-2.5 ring-1 ring-inset sm:flex-row sm:items-center sm:justify-between",
        postponed ? "bg-amber-50/80 ring-amber-200/80" : "bg-sky-50/80 ring-sky-200/80"
      )}
    >
      <div className="min-w-0">
        <p className={cn("text-sm font-semibold", postponed ? "text-amber-900" : "text-sky-900")}>
          {change.title}
        </p>
        <p className={cn(salesTypography.rowMeta, "mt-0.5 text-slate-700")}>{change.detail}</p>
      </div>
      <MyOrderAckButton
        className="w-full justify-center sm:w-auto sm:shrink-0"
        disabled={pending}
        title="Potwierdź, że znasz nowy termin"
        ariaLabel="Przyjąłem/am nowy termin dostawy"
        onClick={onAcknowledge}
      >
        Przyjąłem/am
      </MyOrderAckButton>
    </div>
  );
}
