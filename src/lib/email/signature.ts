/** Podpis maili z OnTime — wspólne dla formularza w Ustawieniach i zapisu na serwerze. */
export const EMAIL_SIGNATURE_MAX = 1000;

/** Tak podpis trafia do bazy — formularz porównuje z tym samym, więc „Zapisz” gaśnie po zapisie. */
export function normalizeEmailSignature(signature: string): string {
  return signature.replace(/\r\n/g, "\n").trim().slice(0, EMAIL_SIGNATURE_MAX);
}
