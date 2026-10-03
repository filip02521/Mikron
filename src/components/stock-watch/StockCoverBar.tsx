import { cn } from "@/lib/cn";
import type { StockWatchStatus } from "@/lib/stock-watch/analysis";
import { formatQtyPl, STOCK_WATCH_STATUS_META } from "@/components/stock-watch/stock-watch-format";

/**
 * Stan dostępny względem bezpiecznego bufora. Kreska = 100% bufora;
 * szary odcinek = towar w drodze (otwarte ZD).
 */
export function StockCoverBar({
  available,
  incoming,
  safetyStock,
  status,
  className,
}: {
  available: number;
  incoming: number;
  safetyStock: number;
  status: StockWatchStatus;
  className?: string;
}) {
  // Skala do 150% bufora — nadwyżka nie rozpycha paska.
  const scale = Math.max(safetyStock * 1.5, available + incoming, 1);
  const availPct = Math.max(0, Math.min(100, (Math.max(0, available) / scale) * 100));
  const incomingPct = Math.max(
    0,
    Math.min(100 - availPct, (Math.max(0, incoming) / scale) * 100)
  );
  const bufferPct = safetyStock > 0 ? Math.min(100, (safetyStock / scale) * 100) : null;
  const coverage =
    safetyStock > 0 ? Math.round((Math.max(0, available) / safetyStock) * 100) : null;

  return (
    <div className={cn("min-w-[9rem]", className)}>
      <div
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`Dostępne ${formatQtyPl(available)} szt, w drodze ${formatQtyPl(incoming)} szt, bufor ${formatQtyPl(safetyStock)} szt`}
      >
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full", STOCK_WATCH_STATUS_META[status].bar)}
          style={{ width: `${availPct}%` }}
        />
        {incomingPct > 0 ? (
          <div
            className="absolute inset-y-0 bg-[repeating-linear-gradient(135deg,var(--color-slate-300)_0_3px,var(--color-slate-200)_3px_6px)]"
            style={{ left: `${availPct}%`, width: `${incomingPct}%` }}
          />
        ) : null}
        {bufferPct != null ? (
          <div
            className="absolute inset-y-[-2px] w-0.5 rounded bg-slate-700/70"
            style={{ left: `calc(${bufferPct}% - 1px)` }}
          />
        ) : null}
      </div>
      <p className="mt-1 flex justify-between gap-2 text-[11px] tabular-nums text-slate-500">
        <span>
          {formatQtyPl(available)} / {formatQtyPl(safetyStock)} szt
        </span>
        {coverage != null ? <span className="font-medium text-slate-600">{coverage}%</span> : null}
      </p>
    </div>
  );
}
