"use client";

import { SalesSyncStrip } from "@/components/sales/SalesSyncStrip";

/** @deprecated Użyj {@link SalesSyncStrip} z variant="orders". */
export function MojeOrdersSyncStrip(props: { className?: string }) {
  return <SalesSyncStrip variant="orders" {...props} />;
}
