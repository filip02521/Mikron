/** Jedna pozycja w mailu do handlowca — dostawa zamówienia indywidualnego. */
export type SalesDeliveryNotificationItem = {
  kind: "delivery";
  supplierName: string;
  products: string;
  symbol: string | null;
  clientName: string | null;
  orderedQty: number | null;
  deliveredQty: number | null;
  deliveryKind: "complete" | "partial";
};

/** Jedna pozycja informacyjna (bez zamówienia u dostawcy). */
export type SalesInformacjaNotificationItem = {
  kind: "informacja";
  supplierName: string;
  products: string;
  symbol: string | null;
  clientName: string | null;
};

export type SalesNotificationItem =
  | SalesDeliveryNotificationItem
  | SalesInformacjaNotificationItem;

export type SalesPersonEmailBatch = {
  email: string;
  name: string;
  items: SalesNotificationItem[];
};
