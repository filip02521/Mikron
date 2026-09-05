/**
 * Klient administracyjny bazy — zamiennik `createClient(url, serviceRoleKey)`
 * z `@supabase/supabase-js`. Zwraca obiekt o tym samym kształcie (`from`, `rpc`),
 * więc istniejący kod aplikacji nie wymaga zmian.
 *
 * Uwierzytelnianie NIE jest częścią tego klienta — `auth.admin.*` celowo rzuca
 * wyjątkiem z podpowiedzią, gdzie szukać lokalnej implementacji.
 */

import { isE2ELab } from "@/lib/e2e-lab/mode";
import { createLocalAuthAdmin } from "./auth-admin";
import { hasDatabaseConfig as poolHasDatabaseConfig } from "./pool";
import { createLocalStorage } from "./storage";
import {
  createQueryBuilder,
  type PostgrestQueryBuilder,
  type Row,
} from "./query-builder";
import { rpc as rpcCall } from "./rpc";

/**
 * Odpowiedzi stubów są luźno typowane, żeby istniejące wywołania
 * (`const { data, error } = await supabase.auth.admin.createUser(...)`)
 * dalej się kompilowały i zawiodły dopiero w czasie działania — z jasnym komunikatem.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StubResponse = Promise<{ data: any; error: any }>;

const AUTH_MIGRATION_HINT =
  "Konta i sesje obsługuje lokalny moduł auth (src/lib/auth), nie klient bazy. " +
  "Użyj funkcji z @/lib/auth zamiast supabase.auth.*";

function authUnavailable(method: string): never {
  throw new Error(`${method} jest niedostępne. ${AUTH_MIGRATION_HINT}`);
}

export interface AuthAdminStub {
  listUsers(...args: unknown[]): StubResponse;
  getUserById(...args: unknown[]): StubResponse;
  createUser(...args: unknown[]): StubResponse;
  updateUserById(...args: unknown[]): StubResponse;
  deleteUser(...args: unknown[]): StubResponse;
  generateLink(...args: unknown[]): StubResponse;
  inviteUserByEmail(...args: unknown[]): StubResponse;
}

export interface AuthStub {
  admin: AuthAdminStub;
  getUser(...args: unknown[]): StubResponse;
  getSession(...args: unknown[]): StubResponse;
  signInWithPassword(...args: unknown[]): StubResponse;
  signOut(...args: unknown[]): StubResponse;
  updateUser(...args: unknown[]): StubResponse;
}

/** Lokalny `auth.admin` na `app_users` + tokenach. */
export function createAuthAdminStub(): AuthStub {
  return {
    admin: createLocalAuthAdmin() as AuthAdminStub,
    getUser: async () => authUnavailable("auth.getUser"),
    getSession: async () => authUnavailable("auth.getSession"),
    signInWithPassword: async () => authUnavailable("auth.signInWithPassword"),
    signOut: async () => authUnavailable("auth.signOut"),
    updateUser: async () => authUnavailable("auth.updateUser"),
  };
}

const STORAGE_MIGRATION_HINT =
  "Storage nie jest częścią lokalnej bazy — pliki wymagają osobnego backendu.";

function storageError(method: string): { data: null; error: { message: string } } {
  return {
    data: null,
    error: { message: `storage.${method} jest niedostępne. ${STORAGE_MIGRATION_HINT}` },
  };
}

export interface StorageBucketStub {
  upload(...args: unknown[]): StubResponse;
  download(...args: unknown[]): StubResponse;
  remove(...args: unknown[]): StubResponse;
  list(...args: unknown[]): StubResponse;
  createSignedUrl(...args: unknown[]): StubResponse;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getPublicUrl(...args: unknown[]): { data: any };
}

export interface StorageStub {
  from(bucket: string): StorageBucketStub;
}

/**
 * Stub `storage` — zwraca błąd zamiast rzucać, bo wywołania sprzątające
 * (`.remove(paths).catch(() => {})`) nie mogą wywrócić całej akcji.
 */
export function createStorageStub(): StorageStub {
  return {
    from() {
      return {
        upload: async () => storageError("upload"),
        download: async () => storageError("download"),
        remove: async () => storageError("remove"),
        list: async () => storageError("list"),
        createSignedUrl: async () => storageError("createSignedUrl"),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      };
    },
  };
}

export interface DatabaseClient {
  from(table: string): PostgrestQueryBuilder;
  rpc(fn: string, params?: Record<string, unknown>): ReturnType<typeof rpcCall>;
  auth: AuthStub;
  storage: StorageStub;
}

/**
 * Klient jest bezstanowy (pula połączeń żyje w `./pool`), więc tworzenie go
 * per żądanie jest tanie — ale trzymamy jedną instancję dla spójności z poprzednim API.
 */
let cachedClient: DatabaseClient | null = null;

export function createAdminClient(..._unused: unknown[]): DatabaseClient {
  // Tak jak poprzedni klient Supabase: brak konfiguracji zgłaszamy natychmiast,
  // żeby literówka w env nie objawiała się jako „pusta lista” w interfejsie.
  // W trybie E2E lab kod i tak bramkuje się na hasDatabaseConfig().
  if (!isE2ELab() && !poolHasDatabaseConfig()) {
    throw new Error("Missing DATABASE_URL");
  }
  if (cachedClient) return cachedClient;
  cachedClient = {
    from(table: string) {
      return createQueryBuilder(table);
    },
    rpc(fn: string, params?: Record<string, unknown>) {
      return rpcCall(fn, params ?? {});
    },
    auth: createAuthAdminStub(),
    storage: createLocalStorage() as StorageStub,
  };
  return cachedClient;
}

/** Czy skonfigurowano połączenie z bazą (w trybie E2E lab celowo `false`). */
export function hasDatabaseConfig(): boolean {
  if (isE2ELab()) return false;
  return poolHasDatabaseConfig();
}

/** Alias zachowany na czas migracji z Supabase — identyczne zachowanie. */
export { hasDatabaseConfig as hasSupabaseConfig };

/** Typ zgodny z dawnym `SupabaseClient` — dla sygnatur przyjmujących klienta. */
export type SupabaseClient = DatabaseClient;

export type { Row };
