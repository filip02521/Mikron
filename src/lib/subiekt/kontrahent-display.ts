/** Etykiety kontrahenta — bezpieczne dla klienta (bez API Subiekta). */

/** Nazwa kontrahenta do wyświetlenia (gdy brak odpowiedzi z API). */
export function fallbackKontrahentDisplay(khId: number): string {
  return `Kontrahent (id ${khId})`;
}

export function kontrahentDisplayName(
  label: string | null | undefined,
  khId: number
): string {
  const trimmed = label?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallbackKontrahentDisplay(khId);
}
