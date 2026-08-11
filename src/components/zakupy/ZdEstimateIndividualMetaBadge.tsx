"use client";

import {
  formatIndividualSalesPeopleShort,
  type ZdEstimateIndividualTwExtra,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { cn } from "@/lib/cn";

/** Badge pod nazwą — rezerwa próśb jest już w „Do ZD” (bez drugiego +qty w komórce). */
export function ZdEstimateIndividualMetaBadge({
  extra,
}: {
  extra: ZdEstimateIndividualTwExtra;
}) {
  const people = formatIndividualSalesPeopleShort(extra.requests);
  const title = [
    `Rezerwa ${formatQty(extra.extraPieces)} szt jest już wliczona w kolumnę „Do ZD” (przed zaokrągleniem opakowania).`,
    ...extra.requests.map((r) => {
      const bits = [
        r.salesPersonName,
        `${formatQty(r.qty)} szt`,
        r.symbol || r.products,
        r.requestNote,
      ].filter(Boolean);
      return bits.join(" · ");
    }),
  ].join("\n");

  return (
    <span
      className={cn(
        "flex max-w-[min(100%,22rem)] flex-col gap-0.5 rounded-md bg-emerald-50 px-1.5 py-1 text-left ring-1 ring-emerald-100"
      )}
      title={title}
    >
      <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-950">
        <span className="rounded bg-emerald-200/70 px-1 py-px text-emerald-950">
          Prośba
        </span>
        <span className="rounded bg-emerald-100/90 px-1 py-px font-semibold normal-case tracking-normal text-emerald-900">
          już w Do ZD
        </span>
      </span>
      <span className="truncate text-[10px] font-medium normal-case tracking-normal text-slate-600">
        {people}
        {extra.requests.length > 1
          ? ` · ${extra.requests.length} próśb`
          : ""}
      </span>
    </span>
  );
}
