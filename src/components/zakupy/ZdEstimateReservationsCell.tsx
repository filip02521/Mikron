"use client";

import { useState, type ReactNode } from "react";
import { ZdEstimateReservationsModal } from "@/components/zakupy/ZdEstimateReservationsModal";
import { ZD_ESTIMATE_UI } from "@/lib/orders/zd-estimate-ui-copy";
import { cn } from "@/lib/cn";

/**
 * Klikalna ilość Rez. — otwiera listę ZK ze statusem zarezerwowanym dla towaru.
 */
export function ZdEstimateReservationsCell({
  twId,
  symbol,
  name,
  reservedQty,
  children,
}: {
  twId: number;
  symbol: string;
  name: string;
  reservedQty: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const canOpen = Number.isFinite(reservedQty) && reservedQty > 0 && twId > 0;

  if (!canOpen) {
    return <>{children}</>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={ZD_ESTIMATE_UI.reservationsCellTitle}
        aria-label={ZD_ESTIMATE_UI.reservationsCellAria(reservedQty, symbol || name)}
        className={cn(
          "zd-estimate-rez-trigger inline-flex max-w-full items-center justify-center rounded-sm",
          "underline decoration-amber-600/50 decoration-dotted underline-offset-2",
          "hover:bg-amber-50/80 hover:decoration-amber-700 focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-amber-500/40"
        )}
      >
        {children}
      </button>
      <ZdEstimateReservationsModal
        open={open}
        onClose={() => setOpen(false)}
        twId={twId}
        symbol={symbol}
        name={name}
        listReservedQty={reservedQty}
      />
    </>
  );
}
