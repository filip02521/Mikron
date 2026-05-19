/** Czytelny komunikat dla typowych błędów PostgREST / Postgres. */
export function formatDbError(error: { message?: string; code?: string }): string {
  const msg = error.message ?? "Błąd bazy danych";

  if (
    msg.includes("request_kind") &&
    (msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      error.code === "42703" ||
      error.code === "PGRST204")
  ) {
    return (
      "W bazie brakuje kolumny request_kind (prośby „Informacja gdy dotarło”). " +
      "W Supabase otwórz SQL Editor i uruchom plik " +
      "supabase/migrations/006_request_kind_informacja.sql, " +
      "następnie odśwież stronę (czasem trzeba odczekać ~30 s na odświeżenie cache)."
    );
  }

  return msg;
}
