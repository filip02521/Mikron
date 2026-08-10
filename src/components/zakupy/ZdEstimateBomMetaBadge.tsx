"use client";

import type { ZdEstimateBomMeta } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { cn } from "@/lib/cn";

/**
 * Badge składu pod nazwą: zestaw (nie na ZD) albo wkład składnika.
 */
export function ZdEstimateBomMetaBadge({ bom }: { bom: ZdEstimateBomMeta }) {
  if (bom.role === "parent") {
    return (
      <span
        className="inline-flex max-w-[min(100%,22rem)] flex-wrap items-center gap-x-1 gap-y-0.5 rounded-md bg-violet-50 px-1.5 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-violet-950 ring-1 ring-violet-100"
        title={ZD_BOM_UI.badgeZestawTitle}
      >
        <span className="rounded bg-violet-200/80 px-1 py-px">Skład</span>
        <span className="rounded bg-slate-200/80 px-1 py-px font-medium normal-case tracking-normal text-slate-700">
          {ZD_BOM_UI.badgeNieZamawiasz}
        </span>
        <span className="font-medium normal-case tracking-normal text-slate-600">
          {ZD_BOM_UI.badgeZestawRole}
        </span>
      </span>
    );
  }

  const sales = bom.contributionSales ?? 0;
  const cover = bom.contributionCover ?? 0;
  const parents = bom.parentTwIds ?? [];

  return (
    <span
      className={cn(
        "flex max-w-[min(100%,22rem)] flex-col gap-0.5 rounded-md px-1.5 py-1 text-left ring-1",
        bom.componentMissing
          ? "bg-amber-50 text-amber-950 ring-amber-100"
          : "bg-violet-50/90 text-violet-950 ring-violet-100"
      )}
      title={
        bom.componentMissing
          ? ZD_BOM_UI.badgeMissingTitle
          : ZD_BOM_UI.badgeContributionTitle(parents)
      }
    >
      <span className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[10px] font-semibold uppercase tracking-wide">
        <span className="rounded bg-violet-200/70 px-1 py-px">Skład</span>
        <span className="font-medium normal-case tracking-normal text-slate-600">
          {ZD_BOM_UI.badgeSkladnikRole}
        </span>
      </span>
      {bom.componentMissing ? (
        <span className="text-[10px] font-medium normal-case tracking-normal text-amber-900">
          {ZD_BOM_UI.badgeMissingShort}
        </span>
      ) : (
        <span className="truncate text-[10px] font-medium normal-case tracking-normal text-slate-600">
          {sales > 0 ? (
            <span>
              {ZD_BOM_UI.badgeSalesFromZestaw(
                formatQty(sales),
                parents.length === 1 ? parents[0] : undefined
              )}
            </span>
          ) : (
            <span className="text-slate-500">{ZD_BOM_UI.badgeSalesZero}</span>
          )}
          {cover > 0 ? (
            <span className="text-slate-500">
              {ZD_BOM_UI.badgeCoverExtra(formatQty(cover))}
            </span>
          ) : null}
        </span>
      )}
    </span>
  );
}
