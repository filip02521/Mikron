import {
  INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT,
  INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE,
} from "@/lib/orders/informacja-flow-copy";

/**
 * Tytuły statusów w „Moje zamówienia”, które logika porównuje (sekcje, układ karty,
 * akcenty terminu). Jedno źródło: poprawka tekstu nie może po cichu zmienić zachowania.
 */
export const MY_ORDER_STATUS_TITLE = {
  beforeOrder: "Przed zamówieniem",
  ordered: "Zamówione",
  partialOnStock: "Częściowo na magazynie",
  informacjaAwaitingProcurement: INFORMACJA_FLOW_SALES_AWAITING_PROCUREMENT.statusTitle,
  informacjaAwaitingWarehouse: INFORMACJA_FLOW_SALES_AWAITING_WAREHOUSE.statusTitle,
} as const;
