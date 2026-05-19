"use client";

import type { IndividualOrder } from "@/types/database";
import { EmptyState } from "@/components/ui/EmptyState";
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
  if (!orders.length) {
    return (
      <EmptyState
        title="Brak pozycji do weryfikacji"
        description="Niekompletne zgłoszenia handlowców pojawią się tutaj."
      />
    );
  }

  return (
    <VerificationWorkspace
      orders={orders}
      suppliers={suppliers}
      salesPeople={salesPeople}
    />
  );
}
