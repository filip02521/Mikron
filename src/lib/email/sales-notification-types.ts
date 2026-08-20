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
  /** Skąd zamknięto prośbę — wpływa na copy w e-mailu. */
  arrivedSource?: "manual" | "stock_auto";
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

/** Zmiana uwag (`sales_request_note`) przez dział zakupów. */
export type SalesRequestNoteUpdateNotificationItem = {
  kind: "request_note_update";
  supplierName: string;
  products: string;
  symbol: string | null;
  clientName: string | null;
  requestNote: string | null;
};

export type SalesNotificationItem =
  | SalesDeliveryNotificationItem
  | SalesInformacjaNotificationItem
  | SalesProcurementCancelNotificationItem
  | SalesRequestNoteUpdateNotificationItem;

export type SalesPersonEmailBatch = {
  email: string;
  name: string;
  items: SalesNotificationItem[];
};
