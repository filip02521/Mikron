/**
 * Błędy biznesowe z server actions — przez wartość zwracaną, nie przez throw.
 *
 * W buildzie produkcyjnym Next.js podmienia treść wyjątku rzuconego z server
 * action na „An error occurred in the Server Components render…” (klient widzi
 * „Minified React error #441”). Komunikaty typu „Nie można dostarczyć więcej
 * niż …”, „Brak interwału u dostawcy …” czy kod potwierdzenia stanu
 * magazynowego ginęły, a UI pokazywało ogólny fallback.
 *
 * Serwer: `return runActionSafely(async () => { ... })` w ciele akcji.
 * Klient: `await unwrapActionResult(actionX(...))` — rzuca `ActionError`
 * z prawdziwą treścią, więc istniejące `catch` działają bez zmian.
 */

import { isRedirectError } from "next/dist/client/components/redirect-error";

export type ActionErrorResult = {
  actionError: string;
  actionErrorCode?: string;
};

export class ActionError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ActionError";
    this.code = code;
  }
}

export function isActionErrorResult(value: unknown): value is ActionErrorResult {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { actionError?: unknown }).actionError === "string"
  );
}

/** Wewnętrzne sygnały Next (redirect / notFound) muszą polecieć dalej jako throw. */
function isNextControlFlowError(error: unknown): boolean {
  if (isRedirectError(error)) return true;
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

export async function runActionSafely<T>(
  fn: () => Promise<T>
): Promise<T | ActionErrorResult> {
  try {
    return await fn();
  } catch (error) {
    if (isNextControlFlowError(error)) throw error;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "";
    const code =
      typeof (error as { code?: unknown } | null)?.code === "string"
        ? ((error as { code: string }).code)
        : undefined;
    console.error("[server action]", message || error);
    return {
      actionError: message || "Operacja nie powiodła się.",
      ...(code ? { actionErrorCode: code } : {}),
    };
  }
}

export async function unwrapActionResult<T>(
  result: T | ActionErrorResult | Promise<T | ActionErrorResult>
): Promise<Exclude<T, ActionErrorResult>> {
  const value = await result;
  if (isActionErrorResult(value)) {
    throw new ActionError(value.actionError, value.actionErrorCode);
  }
  return value as Exclude<T, ActionErrorResult>;
}
