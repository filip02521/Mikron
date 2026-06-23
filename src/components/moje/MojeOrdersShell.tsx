"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import {
  clearMojeZdEtaSessionSync,
  MojeZdEtaSyncClient,
} from "@/components/moje/MojeZdEtaSyncClient";
import { MojeZdEtaDevRefreshButton } from "@/components/moje/MojeZdEtaDevRefreshButton";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import {
  buildOnboardingDayStartContext,
  buildOnboardingMojePresented,
  buildOnboardingMojeArchiveDemo,
  buildOnboardingMojeAnnouncements,
} from "@/lib/sales/sales-onboarding-demo-data";
import type { DepartmentBoardAnnouncementsSlice } from "@/lib/data/department-board";
import type { SalesDayStartContext } from "@/lib/sales/sales-day-start";
import {
  isSubiektAvailableForZdSync,
  type SubiektAvailability,
} from "@/lib/subiekt/availability";

type Presented = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
};

export function MojeOrdersShell({
  initial,
  salesPersonId,
  showSalesSync = false,
  zdEtaSyncMountCount = 0,
  zdEtaSyncEligibleCount = 0,
  dayStartContext = null,
  boardAnnouncements = null,
  boardAnnouncementsError = null,
  focusAnnouncementId = null,
  ...viewProps
}: {
  initial: Presented;
  salesPersonId: string | null;
  showSalesSync?: boolean;
  /** Montuj klienta sync (również gdy Subiekt chwilowo offline). */
  zdEtaSyncMountCount?: number;
  /** Pozycje wymagające sync przy dostępnym Subiekcie. */
  zdEtaSyncEligibleCount?: number;
  dayStartContext?: SalesDayStartContext | null;
  boardAnnouncements?: DepartmentBoardAnnouncementsSlice | null;
  boardAnnouncementsError?: string | null;
  focusAnnouncementId?: string | null;
} & Omit<
  React.ComponentProps<typeof MojeOrdersView>,
  | "zamowienia"
  | "informacje"
  | "productLineCount"
  | "dayStartContext"
  | "boardAnnouncements"
  | "focusAnnouncementId"
>) {
  const tourDemo = useSalesOnboardingDemo("moje");
  const router = useRouter();
  const demoPresented = useMemo(() => buildOnboardingMojePresented(), []);
  const demoArchive = useMemo(() => buildOnboardingMojeArchiveDemo(), []);
  const demoDayStartContext = useMemo(
    () => (salesPersonId ? buildOnboardingDayStartContext(salesPersonId) : null),
    [salesPersonId]
  );
  const demoAnnouncements = useMemo(() => buildOnboardingMojeAnnouncements(), []);
  const effectiveInitial = tourDemo ? demoPresented : initial;
  const presented = effectiveInitial;
  const [subiektReachable, setSubiektReachable] = useState(() =>
    viewProps.subiektAvailability
      ? isSubiektAvailableForZdSync(viewProps.subiektAvailability)
      : true
  );
  const prevSubiektReachableRef = useRef(subiektReachable);
  const handleSubiektStatusChange = useCallback((status: SubiektAvailability) => {
    setSubiektReachable(isSubiektAvailableForZdSync(status));
  }, []);

  useEffect(() => {
    const wasReachable = prevSubiektReachableRef.current;
    prevSubiektReachableRef.current = subiektReachable;
    if (!wasReachable && subiektReachable && showSalesSync && zdEtaSyncMountCount > 0) {
      clearMojeZdEtaSessionSync();
      router.refresh();
    }
  }, [subiektReachable, showSalesSync, zdEtaSyncMountCount, router]);

  const syncEligibleCount = subiektReachable ? zdEtaSyncEligibleCount : 0;

  return (
    <>
      <MojeZdEtaDevRefreshButton />
      {showSalesSync && zdEtaSyncMountCount > 0 ? (
        <MojeZdEtaSyncClient
          syncEligibleCount={syncEligibleCount}
          subiektReachable={subiektReachable}
        />
      ) : null}
      <MojeOrdersView
      {...viewProps}
      onSubiektStatusChange={handleSubiektStatusChange}
      subiektReachable={subiektReachable}
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
      boardAnnouncements={tourDemo ? demoAnnouncements : boardAnnouncements}
      boardAnnouncementsError={tourDemo ? null : boardAnnouncementsError}
      focusAnnouncementId={focusAnnouncementId}
    />
    </>
  );
}
