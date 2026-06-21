import { getAppUrl, isProductionRuntime } from "@/lib/env/app-config";

/** Komunikat po przekierowaniu z ?reason=session (wygasła / nie zapisana sesja). */
export function loginSessionLostMessage(): string {
  if (isProductionRuntime()) {
    return "Sesja wygasła lub nie została zapisana. Zaloguj się ponownie. Jeśli problem wraca, sprawdź, czy przeglądarka nie blokuje ciasteczek dla tej strony.";
  }

  const appUrl = getAppUrl();
  return `Sesja wygasła lub nie została zapisana. W trybie developerskim otwieraj aplikację pod stałym adresem (${appUrl}), zezwól na ciasteczka i dodaj ten URL w Supabase → Authentication → URL Configuration. Szczegóły: docs/mobile-lan-dev.md.`;
}

/** Gdy formularz wysłany bez JS (POST → redirect ?reason=js-required). */
export function loginJsRequiredMessage(): string {
  return "Do logowania wymagany jest JavaScript w przeglądarce. Włącz go i odśwież stronę.";
}

/** Gdy /api/auth/login nie zwróci poprawnego JSON (np. proxy, zły host). */
export function loginServerResponseErrorMessage(): string {
  if (isProductionRuntime()) {
    return "Serwer nie odpowiedział poprawnie. Odśwież stronę i spróbuj ponownie. Jeśli błąd się powtarza, skontaktuj się z administratorem.";
  }

  const appUrl = getAppUrl();
  return `Serwer nie odpowiedział poprawnie. Upewnij się, że ładujesz stronę z tego samego adresu co NEXT_PUBLIC_APP_URL (${appUrl}).`;
}
