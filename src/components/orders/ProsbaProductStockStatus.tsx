"use client";

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  buildProsbaLineStockStatusView,
  buildProsbaSufficientStockSummary,
  prosbaLineStockDetailClass,
  prosbaLineStockIconClass,
  prosbaLineStockShellClass,
  prosbaLineStockTitleClass,
} from "@/lib/orders/prosba-line-stock-ui";
import { cn } from "@/lib/cn";
import { IconAlertCircle, IconPackage, IconWarehouse } from "@/components/icons/StrokeIcons";
import type { IndividualRequestKind } from "@/types/database";
import { formatProsbaZkQuantityInlineHint } from "@/lib/orders/prosba-stock-check";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";

function StockStatusIcon({
  tone,
  assessment,
}: {
  tone: "amber" | "sky" | "slate";
  assessment: string;
}) {
  const className = cn("mt-0.5 size-[18px] shrink-0", prosbaLineStockIconClass(tone));
  if (assessment === "sufficient") {
    return <IconAlertCircle className={className} strokeWidth={2.25} aria-hidden />;
  }
  if (assessment === "insufficient") {
    return <IconPackage className={className} strokeWidth={2.25} aria-hidden />;
  }
  return <IconWarehouse className={className} strokeWidth={2.25} aria-hidden />;
}

/** Kompaktowy status stanu magazynowego — spójny z banerem Subiekta w formularzu prośby. */
export function ProsbaProductStockStatus({
  line,
  requestKind,
  className,
}: {
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  className?: string;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  const view = buildProsbaLineStockStatusView(line, requestKind, teethExemptTwIds);
  if (!view) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        prosbaLineStockShellClass(view.tone),
        className
      )}
    >
      <StockStatusIcon tone={view.tone} assessment={view.assessment} />
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold leading-snug", prosbaLineStockTitleClass(view.tone))}>
          {view.title}
        </p>
        <p className={cn("mt-0.5 text-xs leading-relaxed", prosbaLineStockDetailClass(view.tone))}>
          {view.detail}
        </p>
      </div>
    </div>
  );
}

/** Podpowiedź ilości prośby vs pozycja ZK (prefill z notatnika). */
export function ProsbaZkQuantityHint({
  line,
  requestKind,
  className,
}: {
  line: ProductLineDraft;
  requestKind: IndividualRequestKind;
  className?: string;
}) {
  const hint = formatProsbaZkQuantityInlineHint(line, requestKind);
  if (!hint) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-indigo-200/90 bg-indigo-50/70 px-3 py-2.5",
        className
      )}
    >
      <IconPackage
        size={18}
        strokeWidth={2.25}
        className="mt-0.5 shrink-0 text-indigo-700"
        aria-hidden
      />
      <p className="text-xs leading-relaxed text-indigo-950">{hint}</p>
    </div>
  );
}

/** Produkt z listy zębów — pomijamy kontrolę stanu magazynowego. */
export function ProsbaTeethExemptHint({
  line,
  className,
}: {
  line: ProductLineDraft;
  className?: string;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  if (!isStockExemptTwId(line.subiektTwId, teethExemptTwIds)) return null;

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md border border-violet-200/90 bg-violet-50/70 px-3 py-2.5",
        className
      )}
    >
      <IconWarehouse
        size={18}
        strokeWidth={2.25}
        className="mt-0.5 shrink-0 text-violet-700"
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-snug text-violet-950">
          Produkt z listy zębów
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-violet-900/90">
          Stan magazynowy nie jest weryfikowany — prośba przejdzie bez ostrzeżeń o dostępności.
        </p>
      </div>
    </div>
  );
}

/** Podsumowanie wielu pozycji z wystarczającym stanem (nad listą produktów). */
export function ProsbaProductStockSummary({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  const summary = buildProsbaSufficientStockSummary(count);
  if (!summary) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5",
        prosbaLineStockShellClass("amber"),
        className
      )}
    >
      <IconAlertCircle
        size={18}
        strokeWidth={2.25}
        className={cn("mt-0.5 shrink-0", prosbaLineStockIconClass("amber"))}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={cn("text-xs font-semibold leading-snug", prosbaLineStockTitleClass("amber"))}>
          {summary.title}
        </p>
        <p className={cn("mt-0.5 text-xs leading-relaxed", prosbaLineStockDetailClass("amber"))}>
          {summary.detail}
        </p>
      </div>
    </div>
  );
}
