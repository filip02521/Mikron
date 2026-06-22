import { isRedirectError } from "next/dist/client/components/redirect-error";

/**
 * Wywołanie server action, które może zakończyć się `redirect()`.
 * Błąd redirect musi zostać rzucony dalej — inaczej Next.js nie nawiguje.
 */
export async function runServerActionWithRedirect<T>(
  action: () => Promise<T>,
  onError?: (error: unknown) => void
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    if (isRedirectError(error)) throw error;
    onError?.(error);
    return undefined;
  }
}
