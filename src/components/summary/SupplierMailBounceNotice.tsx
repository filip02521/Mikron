"use client";

import { useEffect, useState } from "react";
import { actionSupplierMailBounces } from "@/app/actions/supplier-mail";
import { IconAlertCircle } from "@/components/icons/StrokeIcons";
import { PageAttentionStrip, PageAttentionStripCta, type PageAttentionStripEdge } from "@/components/ui/PageAttentionStrip";

/**
 * Panel dzienny: mail do dostawcy nie doszedł (zwrot) — jedyny sygnał poczty na panelu.
 * Reszta korespondencji jest w Zakupy → Asystent (Poczta dostawców) z licznikiem w menu.
 */
export function SupplierMailBounceNotice({ edge = "row" }: { edge?: PageAttentionStripEdge }) {
  const [suppliers, setSuppliers] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    actionSupplierMailBounces()
      .then((res) => alive && res.ok && setSuppliers(res.suppliers))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!suppliers.length) return null;
  const names = suppliers.slice(0, 3).join(", ") + (suppliers.length > 3 ? ` i ${suppliers.length - 3} więcej` : "");
  return (
    <PageAttentionStrip
      tone="amber"
      edge={edge}
      role="alert"
      icon={<IconAlertCircle size={17} strokeWidth={2.25} />}
      title={suppliers.length === 1 ? "Mail do dostawcy nie doszedł" : `${suppliers.length} maile do dostawców nie doszły`}
      hint={`${names} - sprawdź adres i wyślij ponownie.`}
      actions={<PageAttentionStripCta href="/zakupy/asystent">Poczta dostawców</PageAttentionStripCta>}
    />
  );
}
