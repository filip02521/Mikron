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

/** Anulowanie prośby przez dział dostaw. */
export type SalesProcurementCancelNotificationItem = {
  kind: "procurement_cancel";
  supplierName: string;
  products: string;
  symbol: string | null;
  clientName: string | null;
  procurementCancelNote: string | null;
};

export type SalesNotificationItem =
  | SalesDeliveryNotificationItem
  | SalesInformacjaNotificationItem
  | SalesProcurementCancelNotificationItem;

export type SalesPersonEmailBatch = {
  email: string;
  name: string;
  items: SalesNotificationItem[];
};
