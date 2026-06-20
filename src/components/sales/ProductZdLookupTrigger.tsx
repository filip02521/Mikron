"use client";

import { useMemo, useState } from "react";
import { ProductZdLookupModal } from "@/components/sales/ProductZdLookupModal";
import { IconSearch } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  readProductZdLookupLastResult,
  type ProductZdLookupStockOutPrefill,
} from "@/lib/orders/product-zd-lookup-session";
import { PRODUCT_ZD_LOOKUP_TRIGGER_LABEL } from "@/lib/orders/product-zd-lookup-ui";
import { brandLinkClass } from "@/lib/ui/ontime-theme";

function lastResultSummary(): string | null {
  const last = readProductZdLookupLastResult();
  if (!last) return null;
  if (last.result.status === "found") {
    const match = last.result.matches[0];
    if (!match) return null;
    return `${last.productLabel} — dostawa ${formatPlDate(match.deadline)} (${match.dokNr})`;
  }
  if (last.result.status === "no_match") {
    return `${last.productLabel} — nie znaleźliśmy otwartego ZD u dostawcy`;
  }
  return null;
}

export function ProductZdLookupTrigger({
  onStockOutPrefill,
  className,
}: {
  onStockOutPrefill?: (prefill: ProductZdLookupStockOutPrefill) => void;
  className?: string;
}) {
  const hydrated = useClientHydrated();
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const summary = useMemo(() => {
    if (!hydrated) return null;
    void refreshKey;
    return lastResultSummary();
  }, [hydrated, refreshKey]);

  return (
    <>
      <div
        className={cn(
          "rounded-lg border border-indigo-100/90 bg-indigo-50/40 px-3 py-2.5 sm:px-3.5",
          className
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex w-full items-start gap-2 text-left text-sm font-medium text-indigo-900",
            "rounded-md transition hover:text-indigo-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
          )}
        >
          <IconSearch size={16} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden />
          <span>{PRODUCT_ZD_LOOKUP_TRIGGER_LABEL}</span>
        </button>
        {summary ? (
          <p className="mt-2 pl-6 text-xs leading-relaxed text-slate-600" role="status">
            Ostatnio: <span className="font-medium text-slate-800">{summary}</span>
            {onStockOutPrefill &&
            readProductZdLookupLastResult()?.result.status === "no_match" ? (
              <>
                {" "}
                <button
                  type="button"
                  className={cn(brandLinkClass, "font-semibold")}
                  onClick={() => {
                    const last = readProductZdLookupLastResult();
                    if (!last || last.result.status !== "no_match") return;
                    onStockOutPrefill({
                      symbol: last.symbol,
                      product: last.productName,
                      subiektTwId: last.subiektTwId,
                      mikranCode: last.mikranCode,
                    });
                  }}
                >
                  Zgłoś brak na stanie
                </button>
              </>
            ) : null}
          </p>
        ) : null}
      </div>

      <ProductZdLookupModal
        open={open}
        onClose={() => {
          setOpen(false);
          setRefreshKey((value) => value + 1);
        }}
        onStockOutPrefill={onStockOutPrefill}
      />
    </>
  );
}
