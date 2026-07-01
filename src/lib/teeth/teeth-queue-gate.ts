import { isIndividualOrderProcurementReady } from "@/lib/orders/procurement-readiness";
import { isInformacjaRequest } from "@/lib/orders/individual";
import type { IndividualOrder } from "@/types/database";

/** Zęby nie trafiają do /weryfikacja — brakujące dane ogólne widać w kolejce /zeby. */
export function teethQueueOrderNeedsHeaderData(order: IndividualOrder): boolean {
  if (isInformacjaRequest(order)) return false;
  return !isIndividualOrderProcurementReady(order);
}

export const TEETH_QUEUE_HEADER_DATA_LABEL = "Brak danych ogólnych";
