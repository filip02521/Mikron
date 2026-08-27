"use client";

import type { ZdEstimateBomMeta } from "@/lib/orders/zd-estimate-bom";
import { ZD_BOM_UI } from "@/lib/orders/zd-estimate-bom-copy";
import { formatQty } from "@/lib/orders/zd-estimate-manual";
import { ZdEstimateStatusBadge } from "@/components/zakupy/ZdEstimateStatusBadge";

/**
 * Badge składu w kolumnie Status — kompaktowa 1 linia; szczegóły w title.
 */
export function ZdEstimateBomMetaBadge({ bom }: { bom: ZdEstimateBomMeta }) {
  if (bom.role === "assembled_parent") {
    return (
      <ZdEstimateStatusBadge
        kind="Skład"
        meta={ZD_BOM_UI.badgeNieZamawiasz}
        tone="indigo"
        title={ZD_BOM_UI.badgeZestawTitle}
      />
    );
  }

  if (bom.role === "purchased_kit") {
    if (bom.purchaseTarget === "kit_from_components") {
      return (
        <ZdEstimateStatusBadge
          kind="Komplet"
          meta={ZD_BOM_UI.badgeKitFromComponentsRole}
          tone="indigo"
          title={
            bom.rollupSales != null && bom.rollupSales > 0
              ? `${ZD_BOM_UI.badgeKitFromComponentsTitle} Ze sprzedaży składników: +${formatQty(bom.rollupSales)}.`
              : ZD_BOM_UI.badgeKitFromComponentsTitle
          }
        />
      );
    }
    const kitOnly = bom.purchaseTarget === "kit_only";
    return (
      <ZdEstimateStatusBadge
        kind="Komplet"
        meta={
          kitOnly ? ZD_BOM_UI.badgeKitOnlyRole : ZD_BOM_UI.badgePurchasedKitRole
        }
        tone={kitOnly ? "sky" : "emerald"}
        title={
          kitOnly
            ? ZD_BOM_UI.badgeKitOnlyTitle
            : ZD_BOM_UI.badgePurchasedKitTitle
        }
      />
    );
  }

  const sales = bom.contributionSales ?? 0;
  const cover = bom.contributionCover ?? 0;
  const parents = bom.parentTwIds ?? [];
  const blocked = bom.purchaseBlocked === true;

  const meta = bom.componentMissing
    ? ZD_BOM_UI.badgeMissingChip
    : blocked
      ? ZD_BOM_UI.badgePurchaseBlockedRole
      : sales > 0
        ? ZD_BOM_UI.badgeSalesFromZestawChip(formatQty(sales))
        : ZD_BOM_UI.badgeSkladnikRole;

  const title = bom.componentMissing
    ? ZD_BOM_UI.badgeMissingTitle
    : blocked
      ? ZD_BOM_UI.badgePurchaseBlockedTitle
      : [
          ZD_BOM_UI.badgeContributionTitle(parents),
          sales > 0
            ? ZD_BOM_UI.badgeSalesFromZestaw(
                formatQty(sales),
                parents.length === 1 ? parents[0] : undefined
              )
            : null,
          cover > 0 ? ZD_BOM_UI.badgeCoverExtra(formatQty(cover)) : null,
        ]
          .filter(Boolean)
          .join(" ");

  return (
    <ZdEstimateStatusBadge
      kind="Skład"
      meta={meta}
      tone={bom.componentMissing ? "amber" : blocked ? "rose" : "indigo"}
      title={title}
    />
  );
}
