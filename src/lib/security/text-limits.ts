/** Limity długości pól tekstowych (ochrona przed nadużyciem / przepełnieniem). */
export const MAX_PRODUCT_TEXT_LEN = 500;
export const MAX_SYMBOL_LEN = 100;
/** Kod Mikran (tw_PLU) — zwykle liczbowy, może być krótki (np. 1). */
export const MAX_MIKRAN_CODE_LEN = 32;
export const MAX_QUANTITY_LEN = 20;
export const MAX_BATCH_ORDER_LINES = 30;
export const MAX_REQUEST_EDIT_LINES = 30;
/** Zbiorcze operacje w kolejce magazynu (dostawy / informacja). */
export const MAX_QUEUE_BATCH_SIZE = 30;
export const MAX_DISPOSITION_NOTE_LEN = 500;
export const MAX_SUPPLIER_NAME_LEN = 200;
export const MAX_SUPPLIER_NOTES_LEN = 2000;
export const MAX_SUPPLIER_MAILS_LEN = 2000;
export const MAX_SUPPLIER_EXTRA_LEN = 2000;
export const MAX_INTERVAL_RAW_LEN = 200;
export const MAX_DELIVERED_QTY_LEN = 20;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function clampText(value: string, maxLen: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return trimmed.slice(0, maxLen);
}

export function clampOptionalText(
  value: string | null | undefined,
  maxLen: number
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
}

export function isValidEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (!e || e.length > 254) return false;
  return EMAIL_RE.test(e);
}

export function assertMaxBatchSize(count: number, max: number, label: string): void {
  if (count > max) {
    throw new Error(`Maksymalnie ${max} ${label} na raz.`);
  }
}
