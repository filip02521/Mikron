"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";

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
  ...viewProps
}: {
  initial: Presented;
  salesPersonId: string | null;
} & Omit<
  React.ComponentProps<typeof MojeOrdersView>,
  "zamowienia" | "informacje" | "productLineCount"
>) {
  const [presented, setPresented] = useState(initial);
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

  return (
    <MojeOrdersView
      {...viewProps}
      zamowienia={presented.zamowienia}
      informacje={presented.informacje}
      productLineCount={presented.productLineCount}
    />
  );
}
