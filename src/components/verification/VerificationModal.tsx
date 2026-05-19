"use client";

import Link from "next/link";
import type { IndividualOrder } from "@/types/database";
import { VerificationWorkspace } from "@/components/verification/VerificationWorkspace";
import { ModalShell } from "@/components/ui/ModalShell";

export function VerificationModal({
  open,
  onClose,
  orders,
  suppliers,
  salesPeople,
}: {
  open: boolean;
  onClose: () => void;
  orders: IndividualOrder[];
  suppliers: { id: string; name: string }[];
  salesPeople: { id: string; name: string }[];
}) {
  const description = `${orders.length} ${
    orders.length === 1 ? "pozycja wymaga" : "pozycji wymaga"
  } uzupełnienia — po zatwierdzeniu trafią do „Prośby handlowców”.`;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title="Uzupełnianie zgłoszeń handlowców"
      description={description}
      titleId="verification-modal-title"
      size="xl"
      tier="top"
      bodyClassName="px-5 py-4 sm:px-6 sm:py-5"
      footer={
        <Link
          href="/weryfikacja"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
          onClick={onClose}
        >
          Otwórz pełny widok weryfikacji
        </Link>
      }
    >
      {orders.length > 0 ? (
        <VerificationWorkspace
          orders={orders}
          suppliers={suppliers}
          salesPeople={salesPeople}
          onQueueEmpty={onClose}
        />
      ) : (
        <p className="py-8 text-center text-sm text-slate-500">
          Wszystkie pozycje zostały uzupełnione.
        </p>
      )}
    </ModalShell>
  );
}
