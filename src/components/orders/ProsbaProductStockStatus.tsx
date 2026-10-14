"use client";

import type { ProductLineDraft } from "@/components/orders/request-product-lines";
import {
  buildProsbaLineStockStatusView,
  buildProsbaSufficientStockSummary,
} from "@/lib/orders/prosba-line-stock-ui";
import { cn } from "@/lib/cn";
import type { IndividualRequestKind } from "@/types/database";
import { formatProsbaZkQuantityInlineHint } from "@/lib/orders/prosba-stock-check";
import { useTeethExemptTwIds } from "@/components/layout/TeethExemptContext";
import { isStockExemptTwId } from "@/lib/orders/teeth-stock-exempt";

/** Status stanu magazynowego — jedna linia tekstu. */
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
    <p role="status" className={cn("text-xs leading-relaxed text-slate-600", className)}>
      <span className="font-medium text-slate-800">{view.title}</span>
      {view.detail ? <span> — {view.detail}</span> : null}
    </p>
  );
}

/** Podpowiedź ilości prośby vs pozycja ZK. */
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
    <p role="status" className={cn("text-xs leading-relaxed text-slate-600", className)}>
      {hint}
    </p>
  );
}

/** Produkt z listy zębów bez przypisanego producenta. */
export function ProsbaTeethExemptHint({
  line,
  className,
}: {
  line: ProductLineDraft;
  className?: string;
}) {
  const teethExemptTwIds = useTeethExemptTwIds();
  if (!isStockExemptTwId(line.subiektTwId, teethExemptTwIds)) return null;
  if (line.teethManufacturer) return null;

  return (
    <p role="status" className={cn("text-xs leading-relaxed text-slate-600", className)}>
      Produkt z listy zębów — stan magazynowy nie jest weryfikowany.
    </p>
  );
}

/** Podsumowanie wielu pozycji ze stanem wystarczającym. */
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
    <p
      role="status"
      aria-live="polite"
      className={cn("text-xs leading-relaxed text-slate-600", className)}
    >
      <span className="font-medium text-slate-800">{summary.title}</span>
      {summary.detail ? <span> — {summary.detail}</span> : null}
    </p>
  );
}
