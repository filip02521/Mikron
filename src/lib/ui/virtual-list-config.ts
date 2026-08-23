/** Poniżej progu renderujemy pełną listę (bez kosztu virtualizera). */
export const MOJE_SHIPMENT_VIRTUAL_THRESHOLD = 40;
export const ZK_WATCH_LIST_VIRTUAL_THRESHOLD = 30;
export const RECEIVE_QUEUE_VIRTUAL_THRESHOLD = 500;
/** Kreator ZD — duże cechy (1k+) bez montażu wszystkich `<tr>`. */
export const ZD_ESTIMATE_TABLE_VIRTUAL_THRESHOLD = 80;

/** Szacunkowa wysokość wiersza (px) — dynamiczny pomiar koryguje po montażu. */
export const MOJE_SHIPMENT_ROW_ESTIMATE_PX = 96;
export const ZK_MONTH_HEADER_ESTIMATE_PX = 40;
export const ZK_WATCH_CARD_ESTIMATE_PX = 88;
export const RECEIVE_QUEUE_HEADER_ESTIMATE_PX = 56;
export const RECEIVE_QUEUE_ORDER_ROW_ESTIMATE_PX = 62;
export const ZD_ESTIMATE_TABLE_ROW_ESTIMATE_PX = 52;
