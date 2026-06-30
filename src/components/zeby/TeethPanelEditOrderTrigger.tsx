"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { actionFetchTeethEditContext } from "@/app/actions/teeth-orders";
import { ModalShell } from "@/components/ui/ModalShell";
import { Button } from "@/components/ui/Button";
import type { EditIndividualRequestInitial } from "@/components/orders/EditIndividualRequestModal";
import type { OrderFormSupplierOption } from "@/lib/orders/order-form-suppliers";

const EditIndividualRequestModal = dynamic(
  () =>
    import("@/components/orders/EditIndividualRequestModal").then((mod) => ({
      default: mod.EditIndividualRequestModal,
    })),
  { ssr: false }
);

export function TeethPanelEditOrderTrigger({
  orderId,
  onSaved,
  className,
  label = "Edytuj listę",
}: {
  orderId: string;
  onSaved?: (message?: string) => void;
  className?: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [editState, setEditState] = useState<{
    orderIds: string[];
    initial: EditIndividualRequestInitial;
    suppliers: OrderFormSupplierOption[];
    salesPeople: { id: string; name: string }[];
  } | null>(null);

  const openEditor = useCallback(async () => {
    setLoading(true);
    setBlockedMessage(null);
    try {
      const ctx = await actionFetchTeethEditContext(orderId);
      if (!ctx.canEdit) {
        setBlockedMessage(ctx.editBlockedReason ?? "Edycja niedostępna");
        return;
      }
      setEditState({
        orderIds: [orderId],
        initial: ctx.initial,
        suppliers: ctx.suppliers,
        salesPeople: ctx.salesPeople,
      });
      setOpen(true);
    } catch (e) {
      setBlockedMessage(e instanceof Error ? e.message : "Nie udało się wczytać prośby");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={className}
        disabled={loading}
        onClick={() => void openEditor()}
      >
        {loading ? "Ładowanie…" : label}
      </Button>

      <ModalShell
        open={blockedMessage != null}
        onClose={() => setBlockedMessage(null)}
        title="Edycja niedostępna"
        size="sm"
        tier="raised"
        bodyClassName="px-5 py-4 sm:px-6"
        footer={
          <Button className="min-h-11 w-full sm:w-auto" onClick={() => setBlockedMessage(null)}>
            Rozumiem
          </Button>
        }
      >
        <p className="text-sm text-slate-600">{blockedMessage}</p>
      </ModalShell>

      {editState ? (
        <EditIndividualRequestModal
          open={open}
          onClose={() => {
            setOpen(false);
            setEditState(null);
          }}
          mode="procurement"
          orderIds={editState.orderIds}
          initial={editState.initial}
          suppliers={editState.suppliers}
          salesPeople={editState.salesPeople}
          autoSaveAfterTeethList
          onSaved={(message) => {
            setOpen(false);
            setEditState(null);
            onSaved?.(message);
          }}
        />
      ) : null}
    </>
  );
}
