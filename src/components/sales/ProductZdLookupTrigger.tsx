"use client";

import { useMemo, useState } from "react";
import { ProductZdLookupModal } from "@/components/sales/ProductZdLookupModal";
import { IconSearch, IconTruck } from "@/components/icons/StrokeIcons";
import { useClientHydrated } from "@/lib/client/use-client-hydrated";
import { cn } from "@/lib/cn";
import { formatPlDate } from "@/lib/display-labels";
import {
  readProductZdLookupLastResult,
  type ProductZdLookupStockOutPrefill,
} from "@/lib/orders/product-zd-lookup-session";
import { PRODUCT_ZD_LOOKUP_TRIGGER_LABEL } from "@/lib/orders/product-zd-lookup-ui";
import { brandLinkClass, salesTypography } from "@/lib/ui/ontime-theme";

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
  suppliers,
}: {
  onStockOutPrefill?: (prefill: ProductZdLookupStockOutPrefill) => void;
  className?: string;
  suppliers: import("@/lib/orders/order-form-suppliers").OrderFormSupplierOption[];
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
          "overflow-hidden rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 to-white shadow-sm shadow-indigo-900/5",
          className
        )}
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "flex w-full items-start gap-3 px-4 py-3.5 text-left transition",
            "hover:bg-indigo-50/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500"
          )}
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <IconTruck size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-indigo-950">
              {PRODUCT_ZD_LOOKUP_TRIGGER_LABEL}
            </span>
            <span className={cn("mt-1 block text-xs leading-relaxed text-slate-600", salesTypography.sectionHint)}>
              Wyszukaj produkt w Subiekcie i sprawdź termin z dokumentu ZD u dostawcy.
            </span>
          </span>
          <IconSearch size={16} className="mt-1 shrink-0 text-indigo-500" aria-hidden />
        </button>
        {summary ? (
          <div className="border-t border-indigo-100/90 bg-white/70 px-4 py-2.5" role="status">
            <p className="text-xs leading-relaxed text-slate-600">
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
          </div>
        ) : null}
      </div>

      <ProductZdLookupModal
        open={open}
        onClose={() => {
          setOpen(false);
          setRefreshKey((value) => value + 1);
        }}
        onStockOutPrefill={onStockOutPrefill}
        suppliers={suppliers}
      />
    </>
  );
}
