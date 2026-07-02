"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";
import {
  salesDayStartPanelDescription,
  sliceSalesDayStartItems,
} from "@/lib/sales/sales-day-start";
import { hrefWithSalesPreviewFromUrl } from "@/lib/nav/sales-preview-href";
import { Card, CardHeader } from "@/components/ui/Card";
import { SectionHeadingIcon } from "@/components/icons/SectionHeadingIcon";
import { IconSun } from "@/components/icons/StrokeIcons";
import { SalesDayStartHelp } from "@/components/moje/SalesDayStartHelp";
import { SalesDayStartItemRow } from "@/components/sales/SalesDayStartItemRow";
import { cn } from "@/lib/cn";
import {
  mojeShipmentListClass,
  mojeShipmentSectionShellClass,
} from "@/lib/ui/moje-shipment-row-styles";
import { brandLinkClass, sectionIconTileBrandClass } from "@/lib/ui/ontime-theme";

export function SalesDayStartPanel({
  snapshot,
  onScrollToSection,
}: {
  snapshot: SalesDayStartSnapshot;
  onScrollToSection?: (scrollTarget: string, fallbackHref: string) => void;
}) {
  const searchParams = useSearchParams();
  const previewDla = searchParams.get("dla");
  const previewHref = (href: string) => hrefWithSalesPreviewFromUrl(href, previewDla);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  if (snapshot.cleared) return null;

  const { visible: visibleItems, hiddenCount } = sliceSalesDayStartItems(
    snapshot.items,
    itemsExpanded
  );

  return (
    <Card padding={false} className="overflow-hidden">
      <CardHeader
        inset
        density="compact"
        leading={
          <SectionHeadingIcon tileClassName={sectionIconTileBrandClass}>
            <IconSun size={20} />
          </SectionHeadingIcon>
        }
        title="Start dnia"
        description={salesDayStartPanelDescription(snapshot.totalActionCount)}
        action={<SalesDayStartHelp />}
      />

      <div className={cn("px-3 pb-3 pt-3 sm:px-4 lg:px-5")}>
        <ul className={cn(mojeShipmentSectionShellClass, mojeShipmentListClass)}>
          {visibleItems.map((item) => (
            <SalesDayStartItemRow
              key={item.id}
              item={item}
              previewHref={previewHref}
              onScrollToSection={onScrollToSection}
            />
          ))}
        </ul>
        {hiddenCount > 0 ? (
          <button
            type="button"
            onClick={() => setItemsExpanded(true)}
            className={cn("mt-2.5 text-xs font-semibold", brandLinkClass)}
          >
            Pokaż jeszcze {hiddenCount}{" "}
            {hiddenCount === 1 ? "zadanie" : hiddenCount < 5 ? "zadania" : "zadań"}
          </button>
        ) : null}
      </div>
    </Card>
  );
}
