"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MyOrderRow } from "@/lib/orders/my-order-presenter";
import { mojePresentedSignature } from "@/lib/orders/moje-presented-sync";
import { MojeOrdersView } from "@/components/moje/MojeOrdersView";

type Presented = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
  productLineCount: number;
};

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
  const inboxSignature = useMemo(() => mojePresentedSignature(initial), [initial]);
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
