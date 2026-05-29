import type { MyOrderRow } from "@/lib/orders/my-order-presenter";

type PresentedInbox = {
  zamowienia: MyOrderRow[];
  informacje: MyOrderRow[];
};

/** Sygnatura do synchronizacji stanu klienta po router.refresh() (np. przypisanie klienta). */
export function mojePresentedSignature(data: PresentedInbox): string {
  return [...data.zamowienia, ...data.informacje]
    .map((r) => {
      const clients = r.lines.map((l) => `${l.id}:${l.clientName ?? ""}`).join(";");
      return [
        r.id,
        r.orderIds.join(","),
        r.clientLabel ?? "",
        clients,
        r.headline ?? "",
        r.pickupPendingCount,
        r.acknowledgeMode,
      ].join(":");
    })
    .join("|");
}
