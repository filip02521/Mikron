"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { mojePresentedSignature } from "@/lib/orders/moje-presented-sync";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import { useSalesOnboardingDemo } from "@/components/sales/SalesOnboardingContext";
import { buildOnboardingMojePresented, buildOnboardingMojeArchiveDemo, buildOnboardingNotepadDemo } from "@/lib/sales/sales-onboarding-demo-data";
import { buildSalesDayStartSnapshot, type SalesDayStartSnapshot } from "@/lib/sales/sales-day-start";

type Presented = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
};

export function MojeOrdersShell({
  initial,
  salesPersonId,
  showSalesSync = false,
  dayStartSnapshot = null,
  ...viewProps
}: {
  initial: Presented;
  salesPersonId: string | null;
  showSalesSync?: boolean;
  dayStartSnapshot?: SalesDayStartSnapshot | null;
} & Omit<
  React.ComponentProps<typeof MojeOrdersView>,
  "zamowienia" | "informacje" | "productLineCount" | "dayStartSnapshot"
>) {
  const tourDemo = useSalesOnboardingDemo("moje");
  const demoPresented = useMemo(() => buildOnboardingMojePresented(), []);
  const demoArchive = useMemo(() => buildOnboardingMojeArchiveDemo(), []);
  const demoDayStart = useMemo(() => {
    if (!tourDemo || !salesPersonId) return null;
    const notepad = buildOnboardingNotepadDemo(salesPersonId);
    return buildSalesDayStartSnapshot({
      rows: [...demoPresented.zamowienia, ...demoPresented.informacje],
      watches: notepad.zkWatches,
      notes: notepad.notes,
    });
  }, [tourDemo, salesPersonId, demoPresented]);
  const effectiveInitial = tourDemo ? demoPresented : initial;
  const [presented, setPresented] = useState(effectiveInitial);
  const inboxSignature = useMemo(
    () => mojePresentedSignature(effectiveInitial),
    [effectiveInitial]
  );
  const inboxSignatureRef = useRef(inboxSignature);

  useEffect(() => {
    setPresented(tourDemo ? demoPresented : initial);
  }, [demoPresented, initial, tourDemo]);

  // Po router.refresh() (anulowanie, odbiór, edycja) RSC podaje nowe `initial`,
  // a lokalny stan listy musi się zsynchronizować — inaczej widać stare wiersze.
  useEffect(() => {
    if (tourDemo) return;
    const prev = inboxSignatureRef.current;
    inboxSignatureRef.current = inboxSignature;
    if (prev === inboxSignature) return;
    setPresented(initial);
  }, [inboxSignature, initial, tourDemo]);

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
      dayStartSnapshot={tourDemo ? demoDayStart : dayStartSnapshot}
    />
  );
}
