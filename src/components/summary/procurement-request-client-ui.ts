/** Czy planowa data jest już w nagłówku bloku dostawcy — nie duplikuj na grupach. */
export function shouldSuppressProcurementGroupPlannedOrderDate(
  showSupplierBlockHeader: boolean
): boolean {
  return showSupplierBlockHeader;
}

/** Czy klient jest już pokazany na poziomie grupy — nie duplikuj na pozycji. */
export function shouldSuppressProcurementLineClient(clientLabel: string | null): boolean {
  return clientLabel != null && !clientLabel.includes("różnych klientów");
}

/** Czy notatka jest już w strefie zamówienia (body) — nie duplikuj na pozycjach. */
export function shouldSuppressProcurementLineRequestNote(sharedGroupNote: string | null): boolean {
  return Boolean(sharedGroupNote);
}
