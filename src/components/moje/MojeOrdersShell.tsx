"use client";

import { useMemo } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import {
  buildOnboardingDayStartContext,
  buildOnboardingMojePresented,
  buildOnboardingMojeArchiveDemo,
} from "@/lib/sales/sales-onboarding-demo-data";
import type { SalesDayStartContext } from "@/lib/sales/sales-day-start";

type Presented = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
};

export function MojeOrdersShell({
  initial,
  salesPersonId,
  showSalesSync = false,
  dayStartContext = null,
  ...viewProps
}: {
  initial: Presented;
  salesPersonId: string | null;
  showSalesSync?: boolean;
  dayStartContext?: SalesDayStartContext | null;
} & Omit<
  React.ComponentProps<typeof MojeOrdersView>,
  "zamowienia" | "informacje" | "productLineCount" | "dayStartContext"
>) {
  const tourDemo = useSalesOnboardingDemo("moje");
  const demoPresented = useMemo(() => buildOnboardingMojePresented(), []);
  const demoArchive = useMemo(() => buildOnboardingMojeArchiveDemo(), []);
  const demoDayStartContext = useMemo(
    () => (salesPersonId ? buildOnboardingDayStartContext(salesPersonId) : null),
    [salesPersonId]
  );
  const effectiveInitial = tourDemo ? demoPresented : initial;
  const presented = effectiveInitial;

  return (
    <MojeOrdersView
      {...viewProps}
      showSalesSync={showSalesSync}
      zamowienia={presented.zamowienia}
      informacje={presented.informacje}
      productLineCount={presented.productLineCount}
      canAcknowledge={tourDemo ? true : viewProps.canAcknowledge}
      tourPreview={tourDemo}
      showProsbaCta={tourDemo ? false : viewProps.showProsbaCta}
      archiwumRecent={tourDemo ? demoArchive.archiwumRecent : viewProps.archiwumRecent}
      archiwumExtended={tourDemo ? demoArchive.archiwumExtended : viewProps.archiwumExtended}
      dayStartContext={tourDemo ? demoDayStartContext : dayStartContext}
    />
  );
}
