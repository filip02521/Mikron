/**
 * Waluty dostępne dla minimalnej wartości zamówienia u dostawcy.
 * Lista używana zarówno w UI (karta dostawcy, modal procurement)
 * jak i w walidacji server action {@link import("@/app/actions/admin").actionUpsertSupplier}.
 */
export const MIN_ORDER_CURRENCY_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "PLN", label: "PLN (zł)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CZK", label: "CZK (Kč)" },
  { value: "CHF", label: "CHF (Fr)" },
];

/** Zbiór dozwolonych kodów walut (uppercase). */
export const MIN_ORDER_CURRENCY_CODES: ReadonlySet<string> = new Set(
  MIN_ORDER_CURRENCY_OPTIONS.map((c) => c.value)
);

/** Maksymalna długość symbolu waluty (bezpieczny limit). */
export const MAX_MIN_ORDER_CURRENCY_LEN = 8;

/** Maksymalna kwota minimalnej wartości zamówienia. */
export const MAX_MIN_ORDER_VALUE = 999999.99;

/**
 * Normalizuje wartość minimalnego zamówienia z formularza do postaci
 * zapisywanej w bazie. Spójna logika dla UI i server action.
 *
 * - `null`, `0`, nie-liczba, wartość ujemna → `null` (brak minimum).
 * - Wartość > 0 → zaokrąglona do 2 miejsc po przecinku, max {@link MAX_MIN_ORDER_VALUE}.
 */
export function normalizeMinOrderValue(
  raw: number | null | undefined
): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.round(n * 100) / 100, MAX_MIN_ORDER_VALUE);
}

/**
 * Normalizuje symbol waluty dla minimalnej wartości zamówienia.
 *
 * - Gdy `minOrderValue` to `null` → waluta też `null`.
 * - Gdy wartość jest ustawiona: waluta z listy dozwolonych, w przeciwnym razie `PLN`.
 * - Nieznane kody (spoza listy) są odrzucane na korzyść `PLN`.
 */
export function normalizeMinOrderCurrency(
  raw: string | null | undefined,
  minOrderValue: number | null
): string | null {
  if (minOrderValue == null) return null;
  const code = (raw ?? "").trim().toUpperCase();
  if (!code) return "PLN";
  if (MIN_ORDER_CURRENCY_CODES.has(code)) return code;
  return "PLN";
}
