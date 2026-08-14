"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatQty } from "@/lib/orders/zd-estimate-manual";

export type ZdEstimateListSummaryLineProps = {
  inScopeCount: number;
  doZdCount: number;
  zdUnitsSum: number;
  piecesArrivingSum: number;
  piecesNeededSum: number;
  excludedCount: number;
  packagingCount: number;
  packagingInDb: number;
  requestTwCount: number;
  requestServiceCount: number;
  requestExtraPieces: number;
  requestsLoading?: boolean;
  requestsWarning?: boolean;
  onRequestsClick?: () => void;
  className?: string;
};

type SummaryBit = { key: string; node: ReactNode };

/**
 * Kompaktowa linia pod belką listy — zastępuje siatkę 6 PanelSummaryMetric.
 */
export function ZdEstimateListSummaryLine({
  inScopeCount,
  doZdCount,
  zdUnitsSum,
  piecesArrivingSum,
  piecesNeededSum,
  excludedCount,
  packagingCount,
  packagingInDb,
  requestTwCount,
  requestServiceCount,
  requestExtraPieces,
  requestsLoading = false,
  requestsWarning = false,
  onRequestsClick,
  className,
}: ZdEstimateListSummaryLineProps) {
  const requestTotal = requestTwCount + requestServiceCount;
  const showRequests =
    requestTotal > 0 || requestsLoading || requestsWarning;
  const requestLabel =
    requestsLoading && requestTotal === 0
      ? "prośby…"
      : `prośby ${requestTotal}`;
  const requestHint = [
    requestTwCount > 0 ? `${requestTwCount} na pozycjach` : null,
    requestServiceCount > 0 ? `${requestServiceCount} usług` : null,
    requestExtraPieces > 0
      ? `+${formatQty(requestExtraPieces)} szt`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const arriveHint =
    piecesArrivingSum > piecesNeededSum
      ? ` (potrzeba ${formatQty(piecesNeededSum)} szt)`
      : "";

  const bits: SummaryBit[] = [
    {
      key: "scope",
      node: (
        <span className="tabular-nums">{inScopeCount} w zakresie</span>
      ),
    },
    {
      key: "dozd",
      node: (
        <span className="font-semibold tabular-nums text-emerald-800">
          {doZdCount} Do ZD
        </span>
      ),
    },
    {
      key: "sum",
      node: (
        <span
          className="tabular-nums"
          title="Jednostki do wpisania w Subiekcie"
        >
          suma {formatQty(zdUnitsSum)}
        </span>
      ),
    },
    {
      key: "arrive",
      node: (
        <span
          className="tabular-nums"
          title={`Sztuki które przyjdą${arriveHint}`}
        >
          {formatQty(piecesArrivingSum)} szt
          {arriveHint ? (
            <span className="text-slate-500">{arriveHint}</span>
          ) : null}
        </span>
      ),
    },
  ];

  if (excludedCount > 0) {
    bits.push({
      key: "ex",
      node: (
        <span className="tabular-nums text-slate-600">
          wykl. {excludedCount}
        </span>
      ),
    });
  }

  bits.push({
    key: "pack",
    node: (
      <span
        className="tabular-nums text-slate-600"
        title={
          packagingInDb > 0
            ? `Z opakowaniem w zakresie · łącznie ${packagingInDb} w bazie`
            : "Z opakowaniem w zakresie"
        }
      >
        opak. {packagingCount}
      </span>
    ),
  });

  if (showRequests) {
    bits.push({
      key: "req",
      node: onRequestsClick ? (
        <button
          type="button"
          onClick={onRequestsClick}
          className={cn(
            "font-medium tabular-nums underline-offset-2 hover:underline",
            requestsWarning ? "text-amber-800" : "text-indigo-800"
          )}
          title={requestHint || "Przejdź do próśb na liście"}
        >
          {requestLabel}
        </button>
      ) : (
        <span
          className={cn(
            "tabular-nums",
            requestsWarning ? "text-amber-800" : "text-slate-700"
          )}
          title={requestHint || undefined}
        >
          {requestLabel}
        </span>
      ),
    });
  }

  return (
    <p
      className={cn(
        "flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs leading-snug text-slate-600",
        className
      )}
      role="status"
      aria-label="Podsumowanie listy"
    >
      {bits.map((bit, i) => (
        <span key={bit.key} className="inline-flex items-baseline gap-x-2">
          {i > 0 ? (
            <span className="select-none text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          {bit.node}
        </span>
      ))}
    </p>
  );
}
