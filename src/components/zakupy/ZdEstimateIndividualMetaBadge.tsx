"use client";

import {
  formatIndividualSalesPeopleShort,
  type ZdEstimateIndividualTwExtra,
} from "@/lib/orders/zd-estimate-individual";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { zdEstimateProsbaWord } from "@/lib/orders/zd-estimate-ui-copy";
import { cn } from "@/lib/cn";

/** Badge pod nazwą — rezerwa próśb jest już w „Do ZD” (bez drugiego +qty w komórce). */
export function ZdEstimateIndividualMetaBadge({
  extra,
  extrasPolicy = "sum",
  doZdSuppressed = false,
}: {
  extra: ZdEstimateIndividualTwExtra;
  extrasPolicy?: "sum" | "max";
  /**
   * Wyświetlane Do ZD nie pochodzi z wyliczenia z prośbą
   * (nadpisanie sesji / wykluczenie).
   */
  doZdSuppressed?: boolean;
}) {
  const people = formatIndividualSalesPeopleShort(extra.requests);
  const policyBit =
    extrasPolicy === "max"
      ? "Polityka: max(niedobór, prośba) — bez dublowania gdy prośba pokrywa niedobór."
      : "Polityka: suma (niedobór + prośba) — rezerwa na wierzchu.";
  const inclusionBit = doZdSuppressed
    ? "Rezerwa NIE jest w aktualnym „Do ZD” (nadpisanie albo wykluczenie)."
    : `Rezerwa ${formatQty(extra.extraPieces)} szt jest już wliczona w kolumnę „Do ZD” (przed zaokrągleniem opakowania).`;
  const title = [
    inclusionBit,
    policyBit,
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

  const chip = doZdSuppressed
    ? "nie w Do ZD"
    : extrasPolicy === "max"
      ? "maks. vs niedobór"
      : "już w Do ZD";

  return (
    <span
      className={cn(
        "flex max-w-[min(100%,22rem)] flex-col gap-0.5 rounded-md px-1.5 py-1 text-left ring-1",
        doZdSuppressed
          ? "bg-amber-50 ring-amber-100"
          : "bg-emerald-50 ring-emerald-100"
      )}
      title={title}
    >
      <span
        className={cn(
          "flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide",
          doZdSuppressed ? "text-amber-950" : "text-emerald-950"
        )}
      >
        <span
          className={cn(
            "rounded px-1 py-px",
            doZdSuppressed
              ? "bg-amber-200/70 text-amber-950"
              : "bg-emerald-200/70 text-emerald-950"
          )}
        >
          Prośba
        </span>
        <span
          className={cn(
            "rounded px-1 py-px font-semibold normal-case tracking-normal",
            doZdSuppressed
              ? "bg-amber-100/90 text-amber-900"
              : "bg-emerald-100/90 text-emerald-900"
          )}
        >
          {chip}
        </span>
      </span>
      <span className="truncate text-[10px] font-medium normal-case tracking-normal text-slate-600">
        {people}
        {extra.requests.length > 1
          ? ` · ${extra.requests.length} ${zdEstimateProsbaWord(extra.requests.length)}`
          : ""}
      </span>
    </span>
  );
}
