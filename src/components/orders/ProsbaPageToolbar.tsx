"use client";

import Link from "next/link";
import { ProductZdLookupTrigger } from "@/components/sales/ProductZdLookupTrigger";
import { ProsbaFormHelp } from "@/components/orders/ProsbaFormHelp";
import { IconClipboardList } from "@/components/icons/StrokeIcons";
import type { ProductZdLookupStockOutPrefill } from "@/lib/orders/product-zd-lookup-session";
import { cn } from "@/lib/cn";
import { pageToolbarSizingClass, pageToolbarSurfaceClass } from "@/lib/ui/ontime-theme";

export function ProsbaPageToolbar({
  mojeHref,
  mojeLabel = "Moje zamówienia",
  showProductZdLookup = false,
  onProductStockOutPrefill,
}: {
  mojeHref: string;
  mojeLabel?: string;
  showProductZdLookup?: boolean;
  onProductStockOutPrefill?: (prefill: ProductZdLookupStockOutPrefill) => void;
}) {
  return (
    <div className="space-y-2">
      {showProductZdLookup ? (
        <ProductZdLookupTrigger onStockOutPrefill={onProductStockOutPrefill} />
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href={mojeHref}
          className={cn(
            pageToolbarSurfaceClass,
            pageToolbarSizingClass,
            "gap-1.5 no-underline hover:bg-slate-50"
          )}
        >
          <IconClipboardList size={15} aria-hidden />
          {mojeLabel}
        </Link>
        <ProsbaFormHelp mojeHref={mojeHref} mojeLabel={mojeLabel} />
      </div>
    </div>
  );
}
