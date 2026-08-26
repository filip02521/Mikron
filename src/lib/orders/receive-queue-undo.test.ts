import { describe, expect, it } from "vitest";
import {
  attachDeliveryNotificationQueueIds,
  collectDeliveryNotificationQueueIds,
  shouldSoftDeleteDeliveryStatsOnRevert,
  type DeliverySnapshot,
} from "./receive-queue-undo-shared";

describe("receive-queue-undo notification queue", () => {
  const snapshots: DeliverySnapshot[] = [
    {
      orderId: "a",
      deliveredQuantity: "1",
      status: "Zrealizowane",
      deliveryAt: null,
      warehouseShelf: null,
    },
    {
      orderId: "b",
      deliveredQuantity: "2",
      status: "Czesciowo_zrealizowane",
      deliveryAt: "2026-01-01T00:00:00Z",
      warehouseShelf: "A1",
    },
  ];

  it("attachDeliveryNotificationQueueIds — dopina queueId do migawek", () => {
    const attached = attachDeliveryNotificationQueueIds(snapshots, {
      a: "queue-a",
      b: "queue-b",
    });
    expect(attached[0]?.queueId).toBe("queue-a");
    expect(attached[1]?.queueId).toBe("queue-b");
  });

  it("collectDeliveryNotificationQueueIds — unikalne id", () => {
    expect(
      collectDeliveryNotificationQueueIds([
        { ...snapshots[0]!, queueId: "q1" },
        { ...snapshots[1]!, queueId: "q1" },
        { ...snapshots[1]!, orderId: "c", queueId: "q2" },
      ])
    ).toEqual(["q1", "q2"]);
  });
});

describe("shouldSoftDeleteDeliveryStatsOnRevert", () => {
  it("usuwa próbkę gdy undo wraca do Zamowione / Czesciowo / Nowe", () => {
    expect(shouldSoftDeleteDeliveryStatsOnRevert("Zamowione")).toBe(true);
    expect(shouldSoftDeleteDeliveryStatsOnRevert("Czesciowo_zrealizowane")).toBe(true);
    expect(shouldSoftDeleteDeliveryStatsOnRevert("Nowe")).toBe(true);
  });

  it("nie usuwa próbki gdy undo zostawia Zrealizowane (np. tylko qty)", () => {
    expect(shouldSoftDeleteDeliveryStatsOnRevert("Zrealizowane")).toBe(false);
  });
});