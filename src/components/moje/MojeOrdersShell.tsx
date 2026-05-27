"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { actionRefreshMojeZdEtas } from "@/app/actions/moje-zd-etas";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";
import {
  MojeZdEtaNotice,
  type MojeZdEtaNoticeState,
} from "@/components/moje/MojeZdEtaNotice";

type Presented = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
};

/** Identyfikator skrzynki — zmiana po anulowaniu / odświeżeniu RSC. */
function mojeInboxSignature(data: Presented): string {
  return [...data.zamowienia, ...data.informacje]
    .map((r) => `${r.id}:${r.orderIds.join(",")}`)
    .join("|");
}

export function MojeOrdersShell({
  initial,
  salesPersonId,
  subiektReachable,
  zdEligibleCount,
  ...viewProps
}: {
  initial: Presented;
  salesPersonId: string | null;
  subiektReachable: boolean;
  zdEligibleCount: number;
} & Omit<
  React.ComponentProps<typeof MojeOrdersView>,
  "zamowienia" | "informacje" | "productLineCount" | "zdEtaNotice"
>) {
  const [presented, setPresented] = useState(initial);
  const [zdEligibleLive, setZdEligibleLive] = useState(zdEligibleCount);
  const inboxSignature = useMemo(() => mojeInboxSignature(initial), [initial]);
  const inboxSignatureRef = useRef(inboxSignature);

  // Po router.refresh() (anulowanie, odbiór, edycja) RSC podaje nowe `initial`,
  // a lokalny stan listy musi się zsynchronizować — inaczej widać stare wiersze.
  useEffect(() => {
    const prev = inboxSignatureRef.current;
    inboxSignatureRef.current = inboxSignature;
    if (prev === inboxSignature) return;
    setPresented(initial);
  }, [inboxSignature, initial]);

  const [zdNotice, setZdNotice] = useState<MojeZdEtaNoticeState>(() => {
    if (!subiektReachable || !salesPersonId) {
      return { status: "idle" };
    }
    if (zdEligibleCount === 0) {
      return { status: "idle" };
    }
    return { status: "loading", eligibleCount: zdEligibleCount };
  });

  useEffect(() => {
    setZdEligibleLive(zdEligibleCount);
  }, [zdEligibleCount]);

  const refreshZd = useCallback(
    async (force = false) => {
      if (!salesPersonId || !subiektReachable) return;

      if (zdEligibleLive > 0) {
        setZdNotice({ status: "loading", eligibleCount: zdEligibleLive });
      }

      const result = await actionRefreshMojeZdEtas(salesPersonId, { force });

      if (!result.ok) {
        setZdNotice({
          status: result.message.includes("niedostępny") ? "unavailable" : "error",
          message: result.message,
        });
        return;
      }

      setPresented({
        zamowienia: result.zamowienia,
        informacje: result.informacje,
        productLineCount: result.productLineCount,
      });
      setZdEligibleLive(result.meta.eligibleCount);
      if (result.meta.eligibleCount > 0 || result.meta.skippedNoSubiektLink > 0) {
        setZdNotice({ status: "ready", meta: result.meta });
      } else {
        setZdNotice({ status: "idle" });
      }
    },
    [salesPersonId, subiektReachable, zdEligibleLive]
  );

  useEffect(() => {
    if (!subiektReachable || !salesPersonId) return;
    void refreshZd(false);
  }, [refreshZd, subiektReachable, salesPersonId]);

  return (
    <MojeOrdersView
      {...viewProps}
      zamowienia={presented.zamowienia}
      informacje={presented.informacje}
      productLineCount={presented.productLineCount}
      zdEtaNoticeSlot={<MojeZdEtaNotice state={zdNotice} />}
    />
  );
}
