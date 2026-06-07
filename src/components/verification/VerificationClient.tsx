"use client";

import type { IndividualOrder } from "@/types/database";
import { VerificationWorkspace } from "@/components/verification/VerificationWorkspace";
import type { VerificationSupplierOption } from "@/lib/orders/verification-form";

export function VerificationClient({
  orders,
  suppliers,
  salesPeople,
}: {
  orders: IndividualOrder[];
  suppliers: VerificationSupplierOption[];
  salesPeople: { id: string; name: string }[];
}) {
  return (
    <VerificationWorkspace
      orders={orders}
      suppliers={suppliers}
      salesPeople={salesPeople}
    />
  );
}
