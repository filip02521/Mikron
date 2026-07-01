import { fetchDeliveryQueue } from "@/lib/data/queries";
import {
  buildTeethReceiveQueue,
  summarizeTeethReceiveInbox,
} from "@/lib/orders/receive-queue-teeth";
import type { IndividualOrder } from "@/types/database";

export type TeethWarehouseStatusSnapshot = {
  summary: ReturnType<typeof summarizeTeethReceiveInbox>;
  orders: IndividualOrder[];
};

export async function fetchTeethWarehouseStatus(): Promise<TeethWarehouseStatusSnapshot> {
  const deliveryOrders = await fetchDeliveryQueue({ lane: "teeth" });
  const teethOrders = buildTeethReceiveQueue(deliveryOrders);
  return {
    summary: summarizeTeethReceiveInbox(deliveryOrders),
    orders: teethOrders,
  };
}
