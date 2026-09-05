/**
 * Zgodność wsteczna: sesję obsługuje lokalny moduł `@/lib/auth-local`.
 * Plik istnieje, żeby `src/proxy.ts` i pozostałe importy działały bez zmian.
 */

export {
  refreshLocalSession as refreshSupabaseSession,
  redirectWithSession,
  type SessionUser,
} from "@/lib/auth-local/middleware-session";
