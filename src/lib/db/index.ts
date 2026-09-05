/**
 * Publiczne API warstwy bazy danych.
 *
 * Warstwa składa się z trzech elementów:
 *  - `pool` — pula połączeń `pg` i helper `query()`,
 *  - `query-builder` — klient zgodny z API PostgREST (`from().select().eq()...`),
 *  - `rpc` — wywołania funkcji Postgresa.
 *
 * W projekcie nie ma schematu Drizzle — `drizzle-orm` pozostaje nieużywane,
 * więc nic tu nie eksportujemy, żeby nie wciągać go do bundle'a.
 */

export {
  getPool,
  hasDatabaseConfig as hasPoolConfig,
  query,
  withClient,
} from "./pool";

export {
  createAdminClient,
  createAuthAdminStub,
  createStorageStub,
  hasDatabaseConfig,
  hasSupabaseConfig,
  type AuthAdminStub,
  type AuthStub,
  type DatabaseClient,
  type StorageBucketStub,
  type StorageStub,
  type SupabaseClient,
} from "./admin";

export {
  createQueryBuilder,
  PostgrestQueryBuilder,
  resetSchemaCache,
  type OrderOptions,
  type PostgrestError,
  type PostgrestListResponse,
  type PostgrestSingleResponse,
  type ReferencedTableOptions,
  type Row,
  type SelectOptions,
  type UpsertOptions,
} from "./query-builder";

export { resetFunctionCache, rpc, type RpcData, type RpcResponse } from "./rpc";
