/** Czy klient jest już pokazany w nagłówku grupy — nie duplikuj na pozycji. */
export function shouldSuppressProcurementLineClient(clientLabel: string | null): boolean {
  return clientLabel != null && !clientLabel.includes("różnych klientów");
}

/** Czy notatka jest już w nagłówku grupy — nie duplikuj na pozycjach. */
export function shouldSuppressProcurementLineRequestNote(sharedGroupNote: string | null): boolean {
  return Boolean(sharedGroupNote);
}
