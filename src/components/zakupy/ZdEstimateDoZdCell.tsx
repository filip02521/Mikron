"use client";

import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackHint,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { cn } from "@/lib/cn";

/**
 * Komórka „Do ZD” — duża liczba decyzji + krótki kontekst.
 * Rezerwa próśb: badge pod nazwą (bez duplikatu „+prośba” tutaj).
 */
export function ZdEstimateDoZdCell({
  qty,
  excluded,
}: {
  qty: ZdPackOrderQty;
  excluded?: boolean;
  /** @deprecated rezerwa pokazana w badge pod nazwą — prop ignorowany. */
  individualExtraPieces?: number;
}) {
  if (excluded) {
    return (
      <span className="text-[13px] font-medium tabular-nums text-slate-300">
        —
      </span>
    );
  }

  const hint = formatZdPackHint(qty);
  const showPieces =
    qty.zdUnits > 0 &&
    qty.hasPackaging &&
    qty.piecesArriving !== qty.zdUnits;

  return (
    <span
      className="inline-flex flex-col items-start gap-0.5"
      title={hint || undefined}
    >
      <span
        className={cn(
          "text-[1.125rem] font-semibold leading-none tabular-nums tracking-tight",
          qty.zdUnits > 0 ? "text-emerald-900" : "text-slate-300"
        )}
      >
        {qty.zdUnits}
      </span>
      {showPieces ? (
        <span className="text-[10px] font-medium leading-tight tabular-nums text-slate-500">
          → {formatQty(qty.piecesArriving)} szt
        </span>
      ) : qty.zdUnits > 0 && !qty.hasPackaging ? (
        <span className="text-[10px] font-medium leading-tight text-slate-400">
          szt
        </span>
      ) : null}
      {qty.roundedUp && qty.zdUnits > 0 ? (
        <span className="text-[10px] font-medium leading-tight text-amber-700/90">
          ↑ zaokr. · {qty.piecesNeeded} szt
        </span>
      ) : null}
    </span>
  );
}
