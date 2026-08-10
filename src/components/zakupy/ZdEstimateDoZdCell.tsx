"use client";

import { formatQty } from "@/lib/orders/zd-estimate-manual";
import {
  formatZdPackHint,
  type ZdPackOrderQty,
} from "@/lib/orders/zd-estimate-packaging";
import { cn } from "@/lib/cn";

/**
 * Komórka „Do ZD” — duża liczba decyzji + krótki kontekst.
 * Szczegóły opakowania (szt/1 j.dok.) są w kolumnie Opak. — tu tylko wynik.
 */
export function ZdEstimateDoZdCell({
  qty,
  excluded,
  individualExtraPieces = 0,
}: {
  qty: ZdPackOrderQty;
  excluded?: boolean;
  individualExtraPieces?: number;
}) {
  if (excluded) {
    return (
      <span className="text-[13px] font-medium tabular-nums text-slate-300">
        —
      </span>
    );
  }

  const extra =
    individualExtraPieces > 0 ? Math.ceil(individualExtraPieces) : 0;
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
      {extra > 0 && qty.zdUnits > 0 ? (
        <span className="text-[10px] font-semibold leading-tight tabular-nums text-emerald-700">
          +{formatQty(extra)} prośba
        </span>
      ) : null}
      {qty.roundedUp && qty.zdUnits > 0 ? (
        <span className="sr-only">
          Zaokrąglono w górę — potrzeba {qty.piecesNeeded} szt
        </span>
      ) : null}
    </span>
  );
}
