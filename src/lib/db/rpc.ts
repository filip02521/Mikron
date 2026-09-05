/**
 * Odpowiednik `supabase.rpc(name, params)` — wywołuje funkcję w Postgresie.
 *
 * Parametry nazwane są mapowane na notację `nazwa => $n`, więc kolejność kluczy
 * w obiekcie nie ma znaczenia. Kształt `data` odpowiada PostgREST:
 * skalar dla funkcji skalarnych, obiekt dla kompozytu, tablica dla `SETOF`/`TABLE`,
 * `null` dla `void`.
 */

import { query } from "./pool";
import type { PostgrestError, Row } from "./query-builder";

/** Wynik RPC jest luźno typowany — tak jak `data` z PostgREST. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RpcData = any;

export interface RpcResponse {
  data: RpcData;
  error: PostgrestError | null;
  count: number | null;
  status: number;
  statusText: string;
}

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function qi(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

interface FunctionMeta {
  returnsSet: boolean;
  returnsVoid: boolean;
  returnsComposite: boolean;
  /** Nazwa argumentu → nazwa typu (np. `jsonb`, `uuid`, `_text`). */
  argumentTypes: Map<string, string>;
}

const FUNCTIONS_SQL = `
  SELECT p.proname AS name,
         p.proretset AS returns_set,
         rt.typname AS return_type,
         rt.typtype::text AS return_type_kind,
         p.proargnames AS argument_names,
         (SELECT array_agg(t.typname::text ORDER BY u.ord)
            FROM unnest(coalesce(p.proallargtypes, p.proargtypes::oid[]))
                 WITH ORDINALITY AS u(type_oid, ord)
            JOIN pg_type t ON t.oid = u.type_oid) AS argument_types
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type rt ON rt.oid = p.prorettype
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
`;

let functionsPromise: Promise<Map<string, FunctionMeta>> | null = null;

/** Czyści cache sygnatur funkcji (po migracji dodającej/zmieniającej funkcję). */
export function resetFunctionCache(): void {
  functionsPromise = null;
}

function loadFunctions(): Promise<Map<string, FunctionMeta>> {
  if (!functionsPromise) {
    functionsPromise = fetchFunctions().catch((err) => {
      functionsPromise = null;
      throw err;
    });
  }
  return functionsPromise;
}

async function fetchFunctions(): Promise<Map<string, FunctionMeta>> {
  const result = await query<{
    name: string;
    returns_set: boolean;
    return_type: string;
    return_type_kind: string;
    argument_names: string[] | null;
    argument_types: string[] | null;
  }>(FUNCTIONS_SQL);

  const functions = new Map<string, FunctionMeta>();
  for (const row of result.rows) {
    const argumentTypes = new Map<string, string>();
    const names = row.argument_names ?? [];
    const types = row.argument_types ?? [];
    for (let i = 0; i < names.length; i += 1) {
      if (names[i] && types[i]) argumentTypes.set(names[i], types[i]);
    }
    // Przy przeciążeniach zostawiamy pierwszą sygnaturę i dopisujemy brakujące argumenty.
    const existing = functions.get(row.name);
    if (existing) {
      for (const [name, type] of argumentTypes) {
        if (!existing.argumentTypes.has(name)) existing.argumentTypes.set(name, type);
      }
      continue;
    }
    functions.set(row.name, {
      returnsSet: row.returns_set,
      returnsVoid: row.return_type === "void",
      returnsComposite: row.return_type_kind === "c",
      argumentTypes,
    });
  }
  return functions;
}

function toPostgrestError(err: unknown, functionName: string): PostgrestError {
  const raw =
    err && typeof err === "object"
      ? (err as {
          message?: unknown;
          code?: unknown;
          detail?: unknown;
          hint?: unknown;
        })
      : {};
  const code = typeof raw.code === "string" ? raw.code : undefined;
  const original =
    typeof raw.message === "string" ? raw.message : "Database error";

  // Zgodność z PostgREST: brak funkcji rozpoznajemy po treści komunikatu.
  const message =
    code === "42883"
      ? `Could not find the function public.${functionName} in the schema cache: ${original}`
      : original;

  return {
    message,
    code,
    details: typeof raw.detail === "string" ? raw.detail : null,
    hint: typeof raw.hint === "string" ? raw.hint : null,
  };
}

function prepareArgument(value: unknown, typeName: string | undefined): unknown {
  if (value == null) return null;
  if (typeName === "json" || typeName === "jsonb") {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  // Bez znanego typu obiekty (nie tablice, nie daty) traktujemy jako JSON.
  if (
    typeName === undefined &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value)
  ) {
    return JSON.stringify(value);
  }
  return value;
}

async function callFunction(
  functionName: string,
  params: Record<string, unknown>
): Promise<RpcResponse> {
  if (!IDENTIFIER_RE.test(functionName)) {
    return {
      data: null,
      error: {
        message: `Invalid function name: ${JSON.stringify(functionName)}`,
        code: "42601",
      },
      count: null,
      status: 400,
      statusText: "Bad Request",
    };
  }

  const functions = await loadFunctions();
  const meta = functions.get(functionName);

  const values: unknown[] = [];
  const args: string[] = [];
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (!IDENTIFIER_RE.test(name)) {
      return {
        data: null,
        error: {
          message: `Invalid parameter name: ${JSON.stringify(name)}`,
          code: "42601",
        },
        count: null,
        status: 400,
        statusText: "Bad Request",
      };
    }
    values.push(prepareArgument(value, meta?.argumentTypes.get(name)));
    args.push(`${qi(name)} => $${values.length}`);
  }

  const call = `${qi("public")}.${qi(functionName)}(${args.join(", ")})`;

  // Funkcje `void` nie mają sensownej reprezentacji jsonb — wołamy je bezpośrednio.
  const text = meta?.returnsVoid
    ? `SELECT ${call}`
    : `SELECT to_jsonb(${qi("__r")}) AS ${qi("__value")} FROM ${call} AS ${qi("__r")}`;

  const result = await query<{ __value: unknown }>(text, values);

  if (meta?.returnsVoid) {
    return { data: null, error: null, count: null, status: 200, statusText: "OK" };
  }

  const rows = result.rows.map((row) => row.__value ?? null);

  if (meta?.returnsSet) {
    return { data: rows, error: null, count: null, status: 200, statusText: "OK" };
  }

  return {
    data: rows.length > 0 ? rows[0] : null,
    error: null,
    count: null,
    status: 200,
    statusText: "OK",
  };
}

const STALE_CACHE_CODES = new Set(["42883", "42P01", "42703", "42704"]);

/** Thenable, żeby `await rpc(...)` i `await rpc(...).single()` działały jak w supabase-js. */
class RpcBuilder implements PromiseLike<RpcResponse> {
  private promise: Promise<RpcResponse> | null = null;
  private singleMode: "none" | "single" | "maybe" = "none";

  constructor(
    private readonly functionName: string,
    private readonly params: Record<string, unknown>
  ) {}

  single(): PromiseLike<RpcResponse> {
    this.singleMode = "single";
    return this;
  }

  maybeSingle(): PromiseLike<RpcResponse> {
    this.singleMode = "maybe";
    return this;
  }

  private async run(): Promise<RpcResponse> {
    let response: RpcResponse;
    try {
      response = await callFunction(this.functionName, this.params);
    } catch (err) {
      const error = toPostgrestError(err, this.functionName);
      if (error.code && STALE_CACHE_CODES.has(error.code)) {
        resetFunctionCache();
        try {
          response = await callFunction(this.functionName, this.params);
        } catch (retryErr) {
          return this.failure(toPostgrestError(retryErr, this.functionName));
        }
      } else {
        return this.failure(error);
      }
    }

    if (response.error || this.singleMode === "none") return response;

    const rows = Array.isArray(response.data) ? response.data : [response.data];
    if (rows.length > 1) {
      return this.failure({
        message: "JSON object requested, multiple (or no) rows returned",
        code: "PGRST116",
        details: "Results contain more than 1 row",
      });
    }
    if (rows.length === 0 || rows[0] == null) {
      if (this.singleMode === "single") {
        return this.failure({
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "The result contains 0 rows",
        });
      }
      return { ...response, data: null };
    }
    return { ...response, data: rows[0] };
  }

  private failure(error: PostgrestError): RpcResponse {
    return {
      data: null,
      error,
      count: null,
      status: error.code === "42883" ? 404 : 400,
      statusText: error.code === "42883" ? "Not Found" : "Bad Request",
    };
  }

  private execute(): Promise<RpcResponse> {
    if (!this.promise) this.promise = this.run();
    return this.promise;
  }

  then<TResult1 = RpcResponse, TResult2 = never>(
    onfulfilled?: ((value: RpcResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<RpcResponse | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<RpcResponse> {
    return this.execute().finally(onfinally);
  }
}

/** Wywołuje funkcję Postgresa z parametrami nazwanymi (`p_key`, `p_ttl_seconds`, ...). */
export function rpc(
  name: string,
  params: Record<string, unknown> = {}
): RpcBuilder {
  return new RpcBuilder(name, params);
}

export type { Row };
