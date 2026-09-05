/**
 * Zgodność wsteczna: `createAdminClient()` / `hasSupabaseConfig()` pochodzą teraz
 * z lokalnej warstwy Postgresa (`@/lib/db`), a nie z `@supabase/supabase-js`.
 *
 * Plik istnieje, żeby ~120 istniejących importów `@/lib/supabase/admin` działało
 * bez zmian. Nowy kod powinien importować bezpośrednio z `@/lib/db/admin`.
 */

export {
  createAdminClient,
  hasDatabaseConfig,
  hasSupabaseConfig,
  type DatabaseClient,
  type SupabaseClient,
} from "@/lib/db/admin";
