"use client";

import type { IndividualOrder } from "@/types/database";
import { VerificationWorkspace } from "@/components/verification/VerificationWorkspace";

export function VerificationClient({
  orders,
  suppliers,
  salesPeople,
}: {
  orders: IndividualOrder[];
  suppliers: { id: string; name: string }[];
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
