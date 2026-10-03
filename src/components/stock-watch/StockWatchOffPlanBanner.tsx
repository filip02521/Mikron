import Link from "next/link";
import { buildZdEstimateLaunchHref } from "@/lib/orders/zd-estimate-supplier-scope";
import type { StockWatchOffPlanSupplier } from "@/lib/stock-watch/data";

function shortDate(key: string | null): string {
  if (!key) return "na żądanie";
  const [, m, d] = key.split("-");
  return m && d ? `plan ${d}.${m}` : key;
}

/** Panel dzienny: „Zamów dziś poza planem” — z nocnej analizy czasu dostaw. */
export function StockWatchOffPlanBanner({
  suppliers,
  canPrepareZd,
}: {
  suppliers: StockWatchOffPlanSupplier[];
  canPrepareZd: boolean;
}) {
  if (suppliers.length === 0) return null;
  const shown = suppliers.slice(0, 6);
  return (
    <section
      aria-label="Zamów dziś poza planem"
      className="mb-4 rounded-lg border border-red-200/80 bg-red-50/50 px-4 py-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-red-950">
          Zamów dziś poza planem — {suppliers.length}{" "}
          {suppliers.length === 1 ? "dostawca" : "dostawców"}
        </p>
        <Link href="/zakupy/braki" className="text-xs font-medium text-red-800 hover:text-red-950">
          Panel Braki →
        </Link>
      </div>
      <p className="mt-0.5 text-[11px] text-red-900/75">
        Towary skończą się, zanim przyjedzie zamówienie złożone dziś — a planowe zamówienie jest później.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {shown.map((s) => (
          <li
            key={s.supplierId}
            className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs"
          >
            <span className="font-medium text-slate-900">{s.supplierName}</span>
            <span className="tabular-nums text-red-700">{s.count} tow.</span>
            <span className="text-slate-400">{shortDate(s.nextOrderDate)}</span>
            {canPrepareZd ? (
              <Link
                href={buildZdEstimateLaunchHref(s.supplierId)}
                className="font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Przygotuj ZD
              </Link>
            ) : null}
          </li>
        ))}
        {suppliers.length > shown.length ? (
          <li className="self-center text-xs text-red-900/70">
            …i {suppliers.length - shown.length} więcej
          </li>
        ) : null}
      </ul>
    </section>
  );
}
