/**
 * Klient zgodny z API PostgREST (`@supabase/supabase-js`) zbudowany na sterowniku `pg`.
 *
 * Wiersze są materializowane przez `to_jsonb` / `jsonb_build_object`, więc typy
 * (timestamptz, numeric, int8, jsonb) serializują się dokładnie tak samo jak w PostgREST —
 * kod aplikacji napisany pod Supabase nie wymaga zmian.
 *
 * Zagnieżdżone zasoby (`supplier:suppliers(*)`, `supplier_schedules(*)`) rozwiązywane są
 * na podstawie prawdziwych kluczy obcych odczytanych z katalogu systemowego, z fallbackiem
 * na konwencje nazw. Relacje 1-1 stają się JOIN-em, relacje 1-n — LATERAL z agregacją,
 * dzięki czemu `!inner`, filtry po kolumnach zagnieżdżonych, `order({ foreignTable })`
 * oraz `count: "exact"` działają w jednym zapytaniu.
 */

import { query } from "./pool";

/* ------------------------------------------------------------------ *
 * Typy publiczne
 * ------------------------------------------------------------------ */

/**
 * Wiersz jest luźno typowany — dokładnie jak `data` z nietypowanego klienta PostgREST.
 * Bez tego setki istniejących rzutowań (`data as OrderRow[]`) przestałyby się kompilować.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseRow = any;

export interface PostgrestError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

interface PostgrestFailure {
  data: null;
  error: PostgrestError;
  count: null;
  status: number;
  statusText: string;
}

interface PostgrestListSuccess {
  data: LooseRow[];
  error: null;
  count: number | null;
  status: number;
  statusText: string;
}

interface PostgrestSingleSuccess {
  data: LooseRow;
  error: null;
  count: number | null;
  status: number;
  statusText: string;
}

/** Unia rozróżniana po `error` — po `if (error) return` `data` zawęża się do nie-null. */
export type PostgrestListResponse = PostgrestListSuccess | PostgrestFailure;
export type PostgrestSingleResponse = PostgrestSingleSuccess | PostgrestFailure;

/**
 * Wewnętrzny kształt odpowiedzi: `data` może być tablicą (select), jednym wierszem
 * (`single`) albo `null` (zapis bez `select`, `head: true`). Publiczny typ jest
 * zawężany dopiero na granicy `then()`.
 */
interface InternalResponse {
  data: LooseRow[] | LooseRow | null;
  error: PostgrestError | null;
  count: number | null;
  status: number;
  statusText: string;
}

export interface SelectOptions {
  count?: "exact" | "planned" | "estimated";
  head?: boolean;
}

export interface UpsertOptions {
  onConflict?: string;
  ignoreDuplicates?: boolean;
  count?: "exact" | "planned" | "estimated";
}

export interface OrderOptions {
  ascending?: boolean;
  nullsFirst?: boolean;
  /** Nazwa (lub alias) zagnieżdżonego zasobu — zgodność z supabase-js. */
  foreignTable?: string;
  referencedTable?: string;
}

export interface ReferencedTableOptions {
  foreignTable?: string;
  referencedTable?: string;
}

/* ------------------------------------------------------------------ *
 * Błędy
 * ------------------------------------------------------------------ */

/** Błąd wykryty jeszcze przed wysłaniem SQL (parsowanie selecta, relacje, identyfikatory). */
class QueryBuilderError extends Error {
  readonly code: string;
  readonly details: string | null;
  readonly hint: string | null;

  constructor(
    message: string,
    code = "PGRST100",
    details: string | null = null,
    hint: string | null = null
  ) {
    super(message);
    this.name = "QueryBuilderError";
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

function toPostgrestError(err: unknown): PostgrestError {
  if (err instanceof QueryBuilderError) {
    return {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
    };
  }
  if (err && typeof err === "object") {
    const raw = err as {
      message?: unknown;
      code?: unknown;
      detail?: unknown;
      details?: unknown;
      hint?: unknown;
    };
    return {
      message:
        typeof raw.message === "string" ? raw.message : "Database error",
      code: typeof raw.code === "string" ? raw.code : undefined,
      details:
        typeof raw.detail === "string"
          ? raw.detail
          : typeof raw.details === "string"
            ? raw.details
            : null,
      hint: typeof raw.hint === "string" ? raw.hint : null,
    };
  }
  return { message: String(err) };
}

function statusForError(error: PostgrestError): { status: number; statusText: string } {
  switch (error.code) {
    case "PGRST116":
      return { status: 406, statusText: "Not Acceptable" };
    case "23505":
      return { status: 409, statusText: "Conflict" };
    case "42P01":
    case "42883":
    case "PGRST200":
      return { status: 404, statusText: "Not Found" };
    case "PGRST201":
      return { status: 300, statusText: "Multiple Choices" };
    default:
      return { status: 400, statusText: "Bad Request" };
  }
}

/* ------------------------------------------------------------------ *
 * Identyfikatory
 * ------------------------------------------------------------------ */

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertIdentifier(name: string, kind: string): string {
  if (!IDENTIFIER_RE.test(name)) {
    throw new QueryBuilderError(
      `Invalid ${kind}: ${JSON.stringify(name)}`,
      "42601"
    );
  }
  return name;
}

/** Cytowanie identyfikatora podwójnymi cudzysłowami. */
function qi(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface TableRef {
  schema: string;
  table: string;
}

function parseTableRef(name: string): TableRef {
  const trimmed = name.trim();
  const dot = trimmed.indexOf(".");
  if (dot === -1) {
    return { schema: "public", table: assertIdentifier(trimmed, "table name") };
  }
  return {
    schema: assertIdentifier(trimmed.slice(0, dot), "schema name"),
    table: assertIdentifier(trimmed.slice(dot + 1), "table name"),
  };
}

function tableKey(ref: TableRef): string {
  return `${ref.schema}.${ref.table}`;
}

function qualified(ref: TableRef): string {
  return `${qi(ref.schema)}.${qi(ref.table)}`;
}

/* ------------------------------------------------------------------ *
 * Cache schematu (kolumny, klucze główne, klucze obce)
 * ------------------------------------------------------------------ */

interface ColumnMeta {
  name: string;
  typeName: string;
  isJson: boolean;
  isArray: boolean;
}

interface ForeignKeyMeta {
  name: string;
  srcSchema: string;
  srcTable: string;
  srcColumns: string[];
  tgtSchema: string;
  tgtTable: string;
  tgtColumns: string[];
  /** Kolumny źródłowe są unikalne → relacja odwrotna jest 1-1, nie 1-n. */
  srcUnique: boolean;
}

interface SchemaSnapshot {
  columns: Map<string, Map<string, ColumnMeta>>;
  primaryKeys: Map<string, string[]>;
  foreignKeysBySource: Map<string, ForeignKeyMeta[]>;
}

const COLUMNS_SQL = `
  SELECT n.nspname AS schema_name,
         c.relname AS table_name,
         a.attname AS column_name,
         t.typname AS type_name,
         t.typcategory::text AS type_category
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
   WHERE a.attnum > 0
     AND NOT a.attisdropped
     AND c.relkind = ANY (ARRAY['r', 'v', 'm', 'p', 'f']::"char"[])
     AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   ORDER BY n.nspname, c.relname, a.attnum
`;

const CONSTRAINTS_SQL = `
  SELECT con.conname AS constraint_name,
         con.contype::text AS constraint_kind,
         sn.nspname AS src_schema,
         sc.relname AS src_table,
         -- attname ma typ "name"; rzutowanie na text[] jest konieczne, bo sterownik
         -- nie parsuje tablic typu "name" i zwrocilby surowy string zamiast tablicy.
         (SELECT array_agg(sa.attname::text ORDER BY k.ord)
            FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute sa
              ON sa.attrelid = con.conrelid AND sa.attnum = k.attnum) AS src_columns,
         tn.nspname AS tgt_schema,
         tc.relname AS tgt_table,
         (SELECT array_agg(ta.attname::text ORDER BY k.ord)
            FROM unnest(con.confkey) WITH ORDINALITY AS k(attnum, ord)
            JOIN pg_attribute ta
              ON ta.attrelid = con.confrelid AND ta.attnum = k.attnum) AS tgt_columns
    FROM pg_constraint con
    JOIN pg_class sc ON sc.oid = con.conrelid
    JOIN pg_namespace sn ON sn.oid = sc.relnamespace
    LEFT JOIN pg_class tc ON tc.oid = con.confrelid
    LEFT JOIN pg_namespace tn ON tn.oid = tc.relnamespace
   WHERE con.contype IN ('f', 'p', 'u')
     AND sn.nspname NOT IN ('pg_catalog', 'information_schema')
`;

let schemaPromise: Promise<SchemaSnapshot> | null = null;

/** Czyści cache katalogu — wołane po błędach „nie ma takiej tabeli/kolumny” oraz z testów. */
export function resetSchemaCache(): void {
  schemaPromise = null;
}

function loadSchema(): Promise<SchemaSnapshot> {
  if (!schemaPromise) {
    schemaPromise = fetchSchema().catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

async function fetchSchema(): Promise<SchemaSnapshot> {
  const [columnsResult, constraintsResult] = await Promise.all([
    query<{
      schema_name: string;
      table_name: string;
      column_name: string;
      type_name: string;
      type_category: string;
    }>(COLUMNS_SQL),
    query<{
      constraint_name: string;
      constraint_kind: string;
      src_schema: string;
      src_table: string;
      src_columns: string[] | null;
      tgt_schema: string | null;
      tgt_table: string | null;
      tgt_columns: string[] | null;
    }>(CONSTRAINTS_SQL),
  ]);

  const columns = new Map<string, Map<string, ColumnMeta>>();
  for (const row of columnsResult.rows) {
    const key = `${row.schema_name}.${row.table_name}`;
    let table = columns.get(key);
    if (!table) {
      table = new Map<string, ColumnMeta>();
      columns.set(key, table);
    }
    table.set(row.column_name, {
      name: row.column_name,
      typeName: row.type_name,
      isJson: row.type_name === "json" || row.type_name === "jsonb",
      isArray: row.type_category === "A",
    });
  }

  const primaryKeys = new Map<string, string[]>();
  const uniqueSets = new Map<string, Set<string>>();
  const foreignKeys: ForeignKeyMeta[] = [];

  for (const row of constraintsResult.rows) {
    const key = `${row.src_schema}.${row.src_table}`;
    const srcColumns = row.src_columns ?? [];
    if (row.constraint_kind === "p") {
      primaryKeys.set(key, srcColumns);
    }
    if (row.constraint_kind === "p" || row.constraint_kind === "u") {
      let set = uniqueSets.get(key);
      if (!set) {
        set = new Set<string>();
        uniqueSets.set(key, set);
      }
      set.add([...srcColumns].sort().join(","));
      continue;
    }
    if (row.constraint_kind === "f" && row.tgt_schema && row.tgt_table) {
      foreignKeys.push({
        name: row.constraint_name,
        srcSchema: row.src_schema,
        srcTable: row.src_table,
        srcColumns,
        tgtSchema: row.tgt_schema,
        tgtTable: row.tgt_table,
        tgtColumns: row.tgt_columns ?? [],
        srcUnique: false,
      });
    }
  }

  const foreignKeysBySource = new Map<string, ForeignKeyMeta[]>();
  for (const fk of foreignKeys) {
    const key = `${fk.srcSchema}.${fk.srcTable}`;
    fk.srcUnique =
      uniqueSets.get(key)?.has([...fk.srcColumns].sort().join(",")) ?? false;
    const list = foreignKeysBySource.get(key);
    if (list) list.push(fk);
    else foreignKeysBySource.set(key, [fk]);
  }

  return { columns, primaryKeys, foreignKeysBySource };
}

function tableColumns(
  snapshot: SchemaSnapshot,
  ref: TableRef
): Map<string, ColumnMeta> | null {
  return snapshot.columns.get(tableKey(ref)) ?? null;
}

function columnMeta(
  snapshot: SchemaSnapshot,
  ref: TableRef,
  column: string
): ColumnMeta | undefined {
  return tableColumns(snapshot, ref)?.get(column);
}

/* ------------------------------------------------------------------ *
 * Relacje między tabelami
 * ------------------------------------------------------------------ */

interface JoinPair {
  parent: string;
  child: string;
}

interface ResolvedRelation {
  kind: "one" | "many";
  child: TableRef;
  pairs: JoinPair[];
}

/**
 * Znane relacje aplikacji — używane tylko wtedy, gdy katalog systemowy nie ma
 * klucza obcego (np. widoki albo baza starsza niż migracja dodająca FK).
 */
const FALLBACK_RELATIONS: Record<string, ResolvedRelation> = {
  "individual_orders->supplier": {
    kind: "one",
    child: { schema: "public", table: "suppliers" },
    pairs: [{ parent: "supplier_id", child: "id" }],
  },
  "individual_orders->suppliers": {
    kind: "one",
    child: { schema: "public", table: "suppliers" },
    pairs: [{ parent: "supplier_id", child: "id" }],
  },
  "individual_orders->sales_person": {
    kind: "one",
    child: { schema: "public", table: "sales_people" },
    pairs: [{ parent: "sales_person_id", child: "id" }],
  },
  "individual_orders->sales_people": {
    kind: "one",
    child: { schema: "public", table: "sales_people" },
    pairs: [{ parent: "sales_person_id", child: "id" }],
  },
  // supplier_schedules.supplier_id jest UNIQUE, więc PostgREST traktuje tę relację
  // jako 1-1 i zwraca obiekt, nie tablicę. Konsumenci obsługują oba kształty.
  "suppliers->supplier_schedules": {
    kind: "one",
    child: { schema: "public", table: "supplier_schedules" },
    pairs: [{ parent: "id", child: "supplier_id" }],
  },
  "vacations->supplier": {
    kind: "one",
    child: { schema: "public", table: "suppliers" },
    pairs: [{ parent: "supplier_id", child: "id" }],
  },
  "vacations->suppliers": {
    kind: "one",
    child: { schema: "public", table: "suppliers" },
    pairs: [{ parent: "supplier_id", child: "id" }],
  },
};

const IRREGULAR_SINGULARS: Record<string, string> = {
  people: "person",
  addresses: "address",
  statuses: "status",
};

/** Prosta singularyzacja nazw tabel (`sales_people` → `sales_person`). */
function singularize(name: string): string {
  const underscore = name.lastIndexOf("_");
  const head = underscore === -1 ? "" : name.slice(0, underscore + 1);
  const tail = underscore === -1 ? name : name.slice(underscore + 1);
  const irregular = IRREGULAR_SINGULARS[tail];
  if (irregular) return `${head}${irregular}`;
  if (tail.endsWith("ies")) return `${head}${tail.slice(0, -3)}y`;
  if (tail.endsWith("ses") || tail.endsWith("xes") || tail.endsWith("zes")) {
    return `${head}${tail.slice(0, -2)}`;
  }
  if (tail.endsWith("s") && !tail.endsWith("ss")) {
    return `${head}${tail.slice(0, -1)}`;
  }
  return name;
}

function resolveRelation(
  snapshot: SchemaSnapshot,
  parent: TableRef,
  embedName: string,
  embedTable: string,
  hint: string | null
): ResolvedRelation {
  const child: TableRef = { schema: parent.schema, table: embedTable };

  const forward = (snapshot.foreignKeysBySource.get(tableKey(parent)) ?? []).filter(
    (fk) => fk.tgtSchema === child.schema && fk.tgtTable === child.table
  );
  const reverse = (snapshot.foreignKeysBySource.get(tableKey(child)) ?? []).filter(
    (fk) => fk.tgtSchema === parent.schema && fk.tgtTable === parent.table
  );

  type Candidate = { fk: ForeignKeyMeta; direction: "forward" | "reverse" };
  let candidates: Candidate[] = [
    ...forward.map((fk): Candidate => ({ fk, direction: "forward" })),
    ...reverse.map((fk): Candidate => ({ fk, direction: "reverse" })),
  ];

  if (hint) {
    const hinted = candidates.filter(
      (candidate) =>
        candidate.fk.name === hint || candidate.fk.srcColumns.includes(hint)
    );
    if (hinted.length > 0) candidates = hinted;
  }

  if (candidates.length > 1) {
    const byName = candidates.filter(
      (candidate) =>
        candidate.direction === "forward" &&
        candidate.fk.srcColumns.length === 1 &&
        candidate.fk.srcColumns[0] === `${embedName}_id`
    );
    if (byName.length === 1) {
      candidates = byName;
    } else {
      const forwardOnly = candidates.filter((c) => c.direction === "forward");
      if (forwardOnly.length === 1) candidates = forwardOnly;
    }
  }

  if (candidates.length === 1) {
    const { fk, direction } = candidates[0];
    if (direction === "forward") {
      return {
        kind: "one",
        child,
        pairs: fk.srcColumns.map((column, index) => ({
          parent: column,
          child: fk.tgtColumns[index],
        })),
      };
    }
    return {
      kind: fk.srcUnique ? "one" : "many",
      child,
      pairs: fk.srcColumns.map((column, index) => ({
        parent: fk.tgtColumns[index],
        child: column,
      })),
    };
  }

  if (candidates.length > 1) {
    throw new QueryBuilderError(
      `Could not embed because more than one relationship was found for '${parent.table}' and '${embedTable}'`,
      "PGRST201",
      candidates.map((candidate) => candidate.fk.name).join(", "),
      "Wskaż klucz obcy w select, np. " +
        `'${embedName}:${embedTable}!${candidates[0].fk.name}(...)'`
    );
  }

  const guessed = guessRelation(snapshot, parent, embedName, child);
  if (guessed) return guessed;

  const fallback =
    FALLBACK_RELATIONS[`${parent.table}->${embedName}`] ??
    FALLBACK_RELATIONS[`${parent.table}->${embedTable}`];
  if (fallback) {
    return { ...fallback, child: { ...fallback.child, schema: parent.schema } };
  }

  throw new QueryBuilderError(
    `Could not find a relationship between '${parent.table}' and '${embedTable}' in the schema cache`,
    "PGRST200",
    null,
    `Dodaj klucz obcy albo kolumnę '${embedName}_id' w tabeli '${parent.table}'.`
  );
}

/** Heurystyka po nazwach kolumn, gdy w bazie nie ma klucza obcego. */
function guessRelation(
  snapshot: SchemaSnapshot,
  parent: TableRef,
  embedName: string,
  child: TableRef
): ResolvedRelation | null {
  const parentColumns = tableColumns(snapshot, parent);
  const childColumns = tableColumns(snapshot, child);
  if (!parentColumns || !childColumns) return null;

  const childKey =
    snapshot.primaryKeys.get(tableKey(child))?.[0] ??
    (childColumns.has("id") ? "id" : null);
  const parentKey =
    snapshot.primaryKeys.get(tableKey(parent))?.[0] ??
    (parentColumns.has("id") ? "id" : null);

  if (childKey) {
    for (const guess of [`${embedName}_id`, `${singularize(child.table)}_id`]) {
      if (parentColumns.has(guess)) {
        return { kind: "one", child, pairs: [{ parent: guess, child: childKey }] };
      }
    }
  }

  if (parentKey) {
    for (const guess of [
      `${singularize(parent.table)}_id`,
      `${parent.table}_id`,
    ]) {
      if (childColumns.has(guess)) {
        return {
          kind: "many",
          child,
          pairs: [{ parent: parentKey, child: guess }],
        };
      }
    }
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Parsowanie `select`
 * ------------------------------------------------------------------ */

type SelectField =
  | { kind: "star" }
  | { kind: "column"; column: string; alias: string | null }
  | {
      kind: "embed";
      name: string;
      table: string;
      hint: string | null;
      inner: boolean;
      fields: SelectField[];
    };

/** Dzieli listę po przecinkach na najwyższym poziomie (z pominięciem nawiasów i cudzysłowów). */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: '"' | "'" | null = null;
  let current = "";

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quote) {
      current += char;
      if (char === "\\" && i + 1 < input.length) {
        current += input[i + 1];
        i += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  return parts.map((part) => part.trim()).filter((part) => part.length > 0);
}

const EMBED_RE =
  /^(?:([A-Za-z_][A-Za-z0-9_]*)\s*:\s*)?([A-Za-z_][A-Za-z0-9_]*)((?:\s*!\s*[A-Za-z_][A-Za-z0-9_]*)*)\s*\(([\s\S]*)\)$/;
const COLUMN_RE =
  /^(?:([A-Za-z_][A-Za-z0-9_]*)\s*:\s*)?([A-Za-z_][A-Za-z0-9_]*)(?:\s*::\s*[A-Za-z_][A-Za-z0-9_ ]*)?$/;

function parseSelect(input: string): SelectField[] {
  const tokens = splitTopLevel(input);
  if (tokens.length === 0) return [{ kind: "star" }];

  return tokens.map((token): SelectField => {
    if (token === "*") return { kind: "star" };

    const embed = EMBED_RE.exec(token);
    if (embed) {
      const [, alias, table, modifiersRaw, body] = embed;
      const modifiers = (modifiersRaw ?? "")
        .split("!")
        .map((part) => part.trim())
        .filter((part) => part.length > 0);
      const inner = modifiers.includes("inner");
      const hint =
        modifiers.find((part) => part !== "inner" && part !== "left") ?? null;
      return {
        kind: "embed",
        name: alias ?? table,
        table,
        hint,
        inner,
        fields: parseSelect(body),
      };
    }

    const column = COLUMN_RE.exec(token);
    if (column) {
      return { kind: "column", column: column[2], alias: column[1] ?? null };
    }

    throw new QueryBuilderError(
      `Unsupported select expression: ${JSON.stringify(token)}`,
      "PGRST100"
    );
  });
}

/* ------------------------------------------------------------------ *
 * Filtry
 * ------------------------------------------------------------------ */

type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "is"
  | "in"
  | "cs"
  | "cd"
  | "ov";

type FilterNode =
  | {
      kind: "cmp";
      column: string;
      op: FilterOp;
      value: unknown;
      negate: boolean;
    }
  | {
      kind: "logic";
      op: "and" | "or";
      items: FilterNode[];
      negate: boolean;
    };

interface FilterSpec {
  /** Nazwa zagnieżdżonego zasobu, do którego filtr się odnosi (null → tabela główna). */
  target: string | null;
  node: FilterNode;
}

const OP_ALIASES: Record<string, FilterOp> = {
  eq: "eq",
  neq: "neq",
  ne: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  like: "like",
  ilike: "ilike",
  is: "is",
  in: "in",
  cs: "cs",
  contains: "cs",
  cd: "cd",
  containedby: "cd",
  ov: "ov",
  overlaps: "ov",
};

function normalizeOp(raw: string): FilterOp {
  const op = OP_ALIASES[raw.trim().toLowerCase()];
  if (!op) {
    throw new QueryBuilderError(
      `Unsupported filter operator: ${JSON.stringify(raw)}`,
      "PGRST100"
    );
  }
  return op;
}

/** Zamienia PostgRESTowy `*` na SQL-owy `%` w wzorcach LIKE/ILIKE. */
function likePattern(value: unknown): string {
  return String(value).replace(/\*/g, "%");
}

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (
    trimmed.length >= 2 &&
    trimmed.startsWith('"') &&
    trimmed.endsWith('"')
  ) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return trimmed;
}

function parseScalarLiteral(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"')) return stripQuotes(trimmed);
  const lowered = trimmed.toLowerCase();
  if (lowered === "null") return null;
  if (lowered === "true") return true;
  if (lowered === "false") return false;
  return trimmed;
}

/** Parsuje listę PostgREST `("a","b")` albo `(1,2)`. */
function parseListLiteral(raw: string): unknown[] {
  let body = raw.trim();
  if (body.startsWith("(") && body.endsWith(")")) {
    body = body.slice(1, -1);
  }
  if (body.trim().length === 0) return [];
  return splitTopLevel(body).map(parseScalarLiteral);
}

/**
 * Parsuje PostgRESTowy łańcuch logiczny, np.
 * `a.eq.1,and(b.is.null,c.not.is.null),or(d.eq.2,e.eq.3)`.
 */
function parseLogicString(input: string, op: "and" | "or"): FilterNode {
  const items = splitTopLevel(input).map(parseLogicItem);
  if (items.length === 1) return items[0];
  return { kind: "logic", op, items, negate: false };
}

const GROUP_RE = /^(not\.)?(and|or)\s*\(([\s\S]*)\)$/i;

function parseLogicItem(token: string): FilterNode {
  const group = GROUP_RE.exec(token);
  if (group) {
    const node = parseLogicString(
      group[3],
      group[2].toLowerCase() as "and" | "or"
    );
    if (node.kind === "logic") {
      return { ...node, negate: Boolean(group[1]) };
    }
    return {
      kind: "logic",
      op: group[2].toLowerCase() as "and" | "or",
      items: [node],
      negate: Boolean(group[1]),
    };
  }

  const firstDot = token.indexOf(".");
  if (firstDot === -1) {
    throw new QueryBuilderError(
      `Unsupported filter expression: ${JSON.stringify(token)}`,
      "PGRST100"
    );
  }

  const column = token.slice(0, firstDot).trim();
  let rest = token.slice(firstDot + 1).trim();
  let negate = false;
  if (/^not\./i.test(rest)) {
    negate = true;
    rest = rest.slice(4).trim();
  }

  const opDot = rest.indexOf(".");
  const opRaw = opDot === -1 ? rest : rest.slice(0, opDot);
  const valueRaw = opDot === -1 ? "" : rest.slice(opDot + 1);
  const op = normalizeOp(opRaw);
  const value = op === "in" ? parseListLiteral(valueRaw) : parseScalarLiteral(valueRaw);

  return { kind: "cmp", column, op, value, negate };
}

/* ------------------------------------------------------------------ *
 * Budowanie SQL
 * ------------------------------------------------------------------ */

const MAX_JSON_PAIRS_PER_CALL = 25;

interface SqlContext {
  snapshot: SchemaSnapshot;
  params: unknown[];
  aliasCounter: { value: number };
}

function nextAlias(ctx: SqlContext): string {
  ctx.aliasCounter.value += 1;
  return `__e${ctx.aliasCounter.value}`;
}

/**
 * Placeholdery są najpierw tokenami, a numery `$n` przypisujemy dopiero po złożeniu
 * całego SQL-a. Dzięki temu kolejność rekurencyjnego budowania JOIN-ów i WHERE nie
 * musi odpowiadać kolejności fragmentów w gotowym zapytaniu.
 */
function addParam(ctx: SqlContext, value: unknown): string {
  ctx.params.push(value === undefined ? null : value);
  return `\u0001P${ctx.params.length - 1}\u0001`;
}

const PARAM_TOKEN_RE = /\u0001P(\d+)\u0001/g;

function finalizeSql(
  text: string,
  rawParams: unknown[]
): { text: string; params: unknown[] } {
  const params: unknown[] = [];
  const positions = new Map<number, number>();
  const finalText = text.replace(PARAM_TOKEN_RE, (_match, index: string) => {
    const raw = Number(index);
    const existing = positions.get(raw);
    if (existing != null) return `$${existing}`;
    params.push(rawParams[raw]);
    positions.set(raw, params.length);
    return `$${params.length}`;
  });
  return { text: finalText, params };
}

/** `jsonb_build_object` ma limit 100 argumentów — dzielimy na porcje i łączymy `||`. */
function buildJsonObject(pairs: Array<[string, string]>): string {
  if (pairs.length === 0) return "'{}'::jsonb";
  const chunks: string[] = [];
  for (let i = 0; i < pairs.length; i += MAX_JSON_PAIRS_PER_CALL) {
    const chunk = pairs.slice(i, i + MAX_JSON_PAIRS_PER_CALL);
    const args = chunk
      .map(([key, expr]) => `${quoteLiteral(key)}, ${expr}`)
      .join(", ");
    chunks.push(`jsonb_build_object(${args})`);
  }
  return chunks.length === 1 ? chunks[0] : `(${chunks.join(" || ")})`;
}

interface EmbedRoute {
  filters: FilterNode[];
  orders: OrderSpecInternal[];
  limit: number | null;
}

interface OrderSpecInternal {
  target: string | null;
  column: string;
  ascending: boolean;
  nullsFirst: boolean | null;
}

interface ScopeResult {
  rowExpr: string;
  joins: string[];
  /** Warunki, które muszą wylądować w WHERE poziomu, na którym stoi scope. */
  conditions: string[];
  /** Aliasy SQL zagnieżdżonych zasobów najwyższego poziomu (do routingu order/filtrów). */
  embedAliases: Map<string, { alias: string; kind: "one" | "many"; child: TableRef }>;
}

/**
 * Buduje wyrażenie jsonb dla jednego poziomu zapytania oraz potrzebne JOIN-y.
 * `routes` jest używane tylko na poziomie 0 — głębsze zasoby nie są celem filtrów.
 */
function buildScope(
  ctx: SqlContext,
  alias: string,
  table: TableRef,
  fields: SelectField[],
  routes: Map<string, EmbedRoute> | null
): ScopeResult {
  const joins: string[] = [];
  const conditions: string[] = [];
  const embedAliases = new Map<
    string,
    { alias: string; kind: "one" | "many"; child: TableRef }
  >();
  const embedPairs: Array<[string, string]> = [];

  for (const field of fields) {
    if (field.kind !== "embed") continue;

    const relation = resolveRelation(
      ctx.snapshot,
      table,
      field.name,
      field.table,
      field.hint
    );
    const route = routes?.get(field.name) ?? routes?.get(field.table) ?? null;

    if (relation.kind === "one") {
      const childAlias = nextAlias(ctx);
      embedAliases.set(field.name, {
        alias: childAlias,
        kind: "one",
        child: relation.child,
      });
      if (field.name !== field.table) {
        embedAliases.set(field.table, {
          alias: childAlias,
          kind: "one",
          child: relation.child,
        });
      }

      const child = buildScope(
        ctx,
        childAlias,
        relation.child,
        field.fields,
        null
      );

      const onConditions = relation.pairs.map(
        (pair) =>
          `${qi(alias)}.${qi(assertIdentifier(pair.parent, "column name"))} = ` +
          `${qi(childAlias)}.${qi(assertIdentifier(pair.child, "column name"))}`
      );

      // PostgREST: filtry na zasobie zagnieżdżonym z `!inner` zawężają wiersze
      // nadrzędne, bez `!inner` tylko zerują zagnieżdżony obiekt.
      const routedConditions = (route?.filters ?? []).map((node) =>
        renderFilterNode(ctx, node, childAlias, relation.child)
      );
      if (field.inner) {
        conditions.push(...routedConditions);
      } else {
        onConditions.push(...routedConditions);
      }

      joins.push(
        `${field.inner ? "JOIN" : "LEFT JOIN"} ${qualified(relation.child)} AS ${qi(
          childAlias
        )} ON ${onConditions.join(" AND ")}`
      );
      joins.push(...child.joins);
      conditions.push(...child.conditions);

      const presenceColumn = qi(
        assertIdentifier(relation.pairs[0].child, "column name")
      );
      embedPairs.push([
        field.name,
        `CASE WHEN ${qi(childAlias)}.${presenceColumn} IS NULL THEN NULL::jsonb ELSE ${
          child.rowExpr
        } END`,
      ]);
      continue;
    }

    // Relacja 1-n → LATERAL z agregacją do tablicy jsonb.
    const childAlias = nextAlias(ctx);
    const aggAlias = nextAlias(ctx);
    embedAliases.set(field.name, {
      alias: aggAlias,
      kind: "many",
      child: relation.child,
    });
    if (field.name !== field.table) {
      embedAliases.set(field.table, {
        alias: aggAlias,
        kind: "many",
        child: relation.child,
      });
    }

    const child = buildScope(ctx, childAlias, relation.child, field.fields, null);
    const lateralConditions = relation.pairs.map(
      (pair) =>
        `${qi(childAlias)}.${qi(assertIdentifier(pair.child, "column name"))} = ` +
        `${qi(alias)}.${qi(assertIdentifier(pair.parent, "column name"))}`
    );
    lateralConditions.push(
      ...(route?.filters ?? []).map((node) =>
        renderFilterNode(ctx, node, childAlias, relation.child)
      )
    );
    lateralConditions.push(...child.conditions);

    const orderBy = renderOrderBy(route?.orders ?? [], childAlias, new Map());
    const limitClause =
      route?.limit != null ? ` LIMIT ${renderInteger(route.limit)}` : "";

    joins.push(
      `LEFT JOIN LATERAL (` +
        ` SELECT coalesce(jsonb_agg(${qi("__s")}.${qi("__row")}), '[]'::jsonb) AS ${qi(
          "__data"
        )}, count(*) AS ${qi("__n")}` +
        ` FROM (` +
        ` SELECT ${child.rowExpr} AS ${qi("__row")}` +
        ` FROM ${qualified(relation.child)} AS ${qi(childAlias)}` +
        (child.joins.length > 0 ? ` ${child.joins.join(" ")}` : "") +
        ` WHERE ${lateralConditions.join(" AND ")}` +
        orderBy +
        limitClause +
        ` ) AS ${qi("__s")}` +
        ` ) AS ${qi(aggAlias)} ON TRUE`
    );

    if (field.inner) {
      conditions.push(`${qi(aggAlias)}.${qi("__n")} > 0`);
    }

    embedPairs.push([field.name, `${qi(aggAlias)}.${qi("__data")}`]);
  }

  const hasStar = fields.some((field) => field.kind === "star");
  let rowExpr: string;

  if (hasStar) {
    const base = `to_jsonb(${qi(alias)})`;
    rowExpr =
      embedPairs.length > 0
        ? `(${base} || ${buildJsonObject(embedPairs)})`
        : base;
  } else {
    const columnPairs: Array<[string, string]> = fields
      .filter(
        (field): field is Extract<SelectField, { kind: "column" }> =>
          field.kind === "column"
      )
      .map((field) => [
        field.alias ?? field.column,
        `${qi(alias)}.${qi(assertIdentifier(field.column, "column name"))}`,
      ]);
    rowExpr = buildJsonObject([...columnPairs, ...embedPairs]);
  }

  return { rowExpr, joins, conditions, embedAliases };
}

function renderInteger(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new QueryBuilderError(
      `Invalid integer value: ${String(value)}`,
      "PGRST100"
    );
  }
  return String(value);
}

function renderFilterNode(
  ctx: SqlContext,
  node: FilterNode,
  alias: string,
  table: TableRef
): string {
  if (node.kind === "logic") {
    if (node.items.length === 0) return "TRUE";
    const parts = node.items.map((item) =>
      renderFilterNode(ctx, item, alias, table)
    );
    const joined = `(${parts.join(node.op === "and" ? " AND " : " OR ")})`;
    return node.negate ? `NOT ${joined}` : joined;
  }

  const column = assertIdentifier(node.column.trim(), "column name");
  const meta = columnMeta(ctx.snapshot, table, column);
  const lhs = `${qi(alias)}.${qi(column)}`;
  const sql = renderComparison(ctx, lhs, node.op, node.value, meta);
  return node.negate ? `NOT (${sql})` : sql;
}

function renderComparison(
  ctx: SqlContext,
  lhs: string,
  op: FilterOp,
  value: unknown,
  meta: ColumnMeta | undefined
): string {
  switch (op) {
    case "is": {
      if (value === null || value === undefined) return `${lhs} IS NULL`;
      if (value === true) return `${lhs} IS TRUE`;
      if (value === false) return `${lhs} IS FALSE`;
      if (typeof value === "string") {
        const lowered = value.toLowerCase();
        if (lowered === "null" || lowered === "unknown") return `${lhs} IS NULL`;
        if (lowered === "true") return `${lhs} IS TRUE`;
        if (lowered === "false") return `${lhs} IS FALSE`;
      }
      throw new QueryBuilderError(
        `Unsupported value for 'is' filter: ${JSON.stringify(value)}`,
        "PGRST100"
      );
    }
    case "eq":
      if (value === null) return `${lhs} IS NULL`;
      return `${lhs} = ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "neq":
      if (value === null) return `${lhs} IS NOT NULL`;
      return `${lhs} <> ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "gt":
      return `${lhs} > ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "gte":
      return `${lhs} >= ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "lt":
      return `${lhs} < ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "lte":
      return `${lhs} <= ${addParam(ctx, prepareFilterValue(value, meta))}`;
    case "like":
      return `${lhs} LIKE ${addParam(ctx, likePattern(value))}`;
    case "ilike":
      return `${lhs} ILIKE ${addParam(ctx, likePattern(value))}`;
    case "in": {
      const values = Array.isArray(value) ? value : [value];
      if (values.length === 0) return "FALSE";
      const prepared = values.map((item) => prepareFilterValue(item, meta));
      const hasNull = prepared.some((item) => item === null);
      const nonNull = prepared.filter((item) => item !== null);
      const parts: string[] = [];
      if (nonNull.length > 0) {
        parts.push(`${lhs} = ANY(${addParam(ctx, nonNull)})`);
      }
      if (hasNull) parts.push(`${lhs} IS NULL`);
      return parts.length === 1 ? parts[0] : `(${parts.join(" OR ")})`;
    }
    case "cs":
      return `${lhs} @> ${addParam(ctx, prepareContainsValue(value, meta))}`;
    case "cd":
      return `${lhs} <@ ${addParam(ctx, prepareContainsValue(value, meta))}`;
    case "ov":
      return `${lhs} && ${addParam(ctx, prepareContainsValue(value, meta))}`;
    default: {
      const exhaustive: never = op;
      throw new QueryBuilderError(
        `Unsupported filter operator: ${String(exhaustive)}`,
        "PGRST100"
      );
    }
  }
}

function prepareFilterValue(value: unknown, meta: ColumnMeta | undefined): unknown {
  if (value === undefined) return null;
  if (meta?.isJson && value !== null && typeof value !== "string") {
    return JSON.stringify(value);
  }
  return value;
}

function prepareContainsValue(value: unknown, meta: ColumnMeta | undefined): unknown {
  if (value === undefined || value === null) return null;
  if (meta?.isJson) {
    return typeof value === "string" ? value : JSON.stringify(value);
  }
  if (!meta?.isArray && !Array.isArray(value) && typeof value === "object") {
    return JSON.stringify(value);
  }
  return value;
}

function renderOrderBy(
  orders: OrderSpecInternal[],
  mainAlias: string,
  embedAliases: Map<string, { alias: string; kind: "one" | "many"; child: TableRef }>
): string {
  if (orders.length === 0) return "";
  const parts: string[] = [];

  for (const order of orders) {
    let alias = mainAlias;
    if (order.target) {
      const embed = embedAliases.get(order.target);
      // Sortowanie po zasobie 1-n dzieje się wewnątrz LATERAL-a, nie tutaj.
      if (!embed || embed.kind === "many") continue;
      alias = embed.alias;
    }
    const column = assertIdentifier(order.column.trim(), "column name");
    const direction = order.ascending ? "ASC" : "DESC";
    const nulls =
      order.nullsFirst === null
        ? ""
        : order.nullsFirst
          ? " NULLS FIRST"
          : " NULLS LAST";
    parts.push(`${qi(alias)}.${qi(column)} ${direction}${nulls}`);
  }

  return parts.length > 0 ? ` ORDER BY ${parts.join(", ")}` : "";
}

/* ------------------------------------------------------------------ *
 * Stan buildera i wykonanie
 * ------------------------------------------------------------------ */

type Mode = "select" | "insert" | "update" | "upsert" | "delete";

interface BuilderState {
  table: TableRef;
  mode: Mode;
  selectString: string | null;
  returning: boolean;
  count: "exact" | "planned" | "estimated" | null;
  head: boolean;
  filters: FilterSpec[];
  orders: OrderSpecInternal[];
  limitCount: number | null;
  offset: number | null;
  limitTargets: Map<string, number>;
  singleMode: "none" | "single" | "maybe";
  values: Row[];
  updateValues: Row | null;
  onConflict: string | null;
  ignoreDuplicates: boolean;
}

function defaultMaxRows(): number {
  const raw = Number(process.env.DB_MAX_ROWS ?? 1000);
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 1000;
}

interface BuiltQuery {
  rowsText: string;
  rowsParams: unknown[];
  /** Osobne zapytanie liczące — używane dla `head: true` i gdy strona wyszła pusta. */
  countText: string | null;
  countParams: unknown[];
}

/** Rozdziela filtry, sortowania i limity pomiędzy tabelę główną i zasoby zagnieżdżone. */
function buildRoutes(
  state: BuilderState,
  embedNames: Set<string>
): {
  routes: Map<string, EmbedRoute>;
  mainFilters: FilterNode[];
  mainOrders: OrderSpecInternal[];
} {
  const routes = new Map<string, EmbedRoute>();
  const mainFilters: FilterNode[] = [];
  const mainOrders: OrderSpecInternal[] = [];

  const routeFor = (name: string): EmbedRoute => {
    let route = routes.get(name);
    if (!route) {
      route = { filters: [], orders: [], limit: null };
      routes.set(name, route);
    }
    return route;
  };

  for (const spec of state.filters) {
    let target = spec.target;
    let node = spec.node;

    if (!target && node.kind === "cmp") {
      const dot = node.column.indexOf(".");
      if (dot > 0) {
        const prefix = node.column.slice(0, dot);
        if (embedNames.has(prefix)) {
          target = prefix;
          node = { ...node, column: node.column.slice(dot + 1) };
        }
      }
    }

    if (target && embedNames.has(target)) routeFor(target).filters.push(node);
    else mainFilters.push(node);
  }

  for (const order of state.orders) {
    if (order.target && embedNames.has(order.target)) {
      routeFor(order.target).orders.push({ ...order, target: null });
    } else if (order.target) {
      // Nieznany zasób — traktujemy jak kolumnę tabeli głównej.
      mainOrders.push({ ...order, target: null });
    } else {
      mainOrders.push(order);
    }
  }

  for (const [name, limit] of state.limitTargets) {
    if (embedNames.has(name)) routeFor(name).limit = limit;
  }

  return { routes, mainFilters, mainOrders };
}

function collectEmbedNames(fields: SelectField[]): Set<string> {
  const names = new Set<string>();
  for (const field of fields) {
    if (field.kind === "embed") {
      names.add(field.name);
      names.add(field.table);
    }
  }
  return names;
}

function buildSelectQuery(
  state: BuilderState,
  snapshot: SchemaSnapshot
): BuiltQuery {
  const ctx: SqlContext = { snapshot, params: [], aliasCounter: { value: 0 } };
  const fields = parseSelect(state.selectString ?? "*");
  const { routes, mainFilters, mainOrders } = buildRoutes(
    state,
    collectEmbedNames(fields)
  );

  const mainAlias = "__t";
  const scope = buildScope(ctx, mainAlias, state.table, fields, routes);

  const where = [
    ...scope.conditions,
    ...mainFilters.map((node) =>
      renderFilterNode(ctx, node, mainAlias, state.table)
    ),
  ];

  const from =
    ` FROM ${qualified(state.table)} AS ${qi(mainAlias)}` +
    (scope.joins.length > 0 ? ` ${scope.joins.join(" ")}` : "") +
    (where.length > 0 ? ` WHERE ${where.join(" AND ")}` : "");

  const countSql = `SELECT count(*) AS ${qi("__count")}${from}`;

  if (state.head) {
    const finalized = finalizeSql(countSql, ctx.params);
    return {
      rowsText: finalized.text,
      rowsParams: finalized.params,
      countText: null,
      countParams: [],
    };
  }

  const rowsSql =
    `SELECT ${scope.rowExpr} AS ${qi("__row")}` +
    (state.count ? `, count(*) OVER () AS ${qi("__count")}` : "") +
    from +
    renderOrderBy(mainOrders, mainAlias, scope.embedAliases) +
    renderLimitOffset(state);

  const rows = finalizeSql(rowsSql, ctx.params);
  const count = state.count ? finalizeSql(countSql, ctx.params) : null;

  return {
    rowsText: rows.text,
    rowsParams: rows.params,
    countText: count?.text ?? null,
    countParams: count?.params ?? [],
  };
}

function renderLimitOffset(state: BuilderState): string {
  let limit = state.limitCount;
  if (limit == null) {
    limit = state.singleMode === "none" ? defaultMaxRows() : 2;
  }
  const offset = state.offset ?? 0;
  return ` LIMIT ${renderInteger(limit)}${offset > 0 ? ` OFFSET ${renderInteger(offset)}` : ""}`;
}

function prepareWriteValue(value: unknown, meta: ColumnMeta | undefined): unknown {
  if (value === null || value === undefined) return null;
  // PostgREST wysyła JSON, więc kolumny json/jsonb zawsze dostają serializowaną wartość.
  if (meta?.isJson) return JSON.stringify(value);
  return value;
}

function buildWriteQuery(
  state: BuilderState,
  snapshot: SchemaSnapshot
): BuiltQuery {
  const ctx: SqlContext = { snapshot, params: [], aliasCounter: { value: 0 } };
  const columns = tableColumns(snapshot, state.table);
  const write = renderWriteStatement(state, ctx, columns);

  if (!state.returning) {
    const finalized = finalizeSql(write, ctx.params);
    return {
      rowsText: finalized.text,
      rowsParams: finalized.params,
      countText: null,
      countParams: [],
    };
  }

  const fields = parseSelect(state.selectString ?? "*");
  const { routes } = buildRoutes(state, collectEmbedNames(fields));
  const mainAlias = "__t";
  const cteAlias = "__w";
  const scope = buildScope(ctx, mainAlias, state.table, fields, routes);

  const outerWhere =
    scope.conditions.length > 0 ? ` WHERE ${scope.conditions.join(" AND ")}` : "";

  const rowsSql =
    `WITH ${qi(cteAlias)} AS (${write} RETURNING *)` +
    ` SELECT ${scope.rowExpr} AS ${qi("__row")}` +
    (state.count ? `, count(*) OVER () AS ${qi("__count")}` : "") +
    ` FROM ${qi(cteAlias)} AS ${qi(mainAlias)}` +
    (scope.joins.length > 0 ? ` ${scope.joins.join(" ")}` : "") +
    outerWhere;

  const finalized = finalizeSql(rowsSql, ctx.params);
  return {
    rowsText: finalized.text,
    rowsParams: finalized.params,
    countText: null,
    countParams: [],
  };
}

function renderWriteStatement(
  state: BuilderState,
  ctx: SqlContext,
  columns: Map<string, ColumnMeta> | null
): string {
  if (state.mode === "insert" || state.mode === "upsert") {
    return renderInsert(state, ctx, columns);
  }
  if (state.mode === "update") {
    return renderUpdate(state, ctx, columns);
  }
  return renderDelete(state, ctx);
}

function renderInsert(
  state: BuilderState,
  ctx: SqlContext,
  columns: Map<string, ColumnMeta> | null
): string {
  const rows = state.values;
  if (rows.length === 0) {
    throw new QueryBuilderError("No rows to insert", "PGRST102");
  }

  const columnNames: string[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined) continue;
      if (!columnNames.includes(key)) columnNames.push(key);
    }
  }
  if (columnNames.length === 0) {
    throw new QueryBuilderError("No columns to insert", "PGRST102");
  }
  for (const name of columnNames) assertIdentifier(name, "column name");

  const valuesSql = rows
    .map((row) => {
      const cells = columnNames.map((name) => {
        const value = row[name];
        if (value === undefined) return "DEFAULT";
        return addParam(ctx, prepareWriteValue(value, columns?.get(name)));
      });
      return `(${cells.join(", ")})`;
    })
    .join(", ");

  let conflict = "";
  if (state.mode === "upsert") {
    conflict = renderConflictClause(state, ctx, columnNames);
  }

  return (
    `INSERT INTO ${qualified(state.table)} (${columnNames
      .map(qi)
      .join(", ")}) VALUES ${valuesSql}${conflict}`
  );
}

function renderConflictClause(
  state: BuilderState,
  ctx: SqlContext,
  columnNames: string[]
): string {
  const targetColumns = state.onConflict
    ? state.onConflict
        .split(",")
        .map((part) => assertIdentifier(part.trim(), "column name"))
    : (ctx.snapshot.primaryKeys.get(tableKey(state.table)) ?? []);

  if (targetColumns.length === 0) return "";

  const target = `(${targetColumns.map(qi).join(", ")})`;
  if (state.ignoreDuplicates) return ` ON CONFLICT ${target} DO NOTHING`;

  const updatable = columnNames.filter((name) => !targetColumns.includes(name));
  if (updatable.length === 0) return ` ON CONFLICT ${target} DO NOTHING`;

  const assignments = updatable
    .map((name) => `${qi(name)} = EXCLUDED.${qi(name)}`)
    .join(", ");
  return ` ON CONFLICT ${target} DO UPDATE SET ${assignments}`;
}

function renderUpdate(
  state: BuilderState,
  ctx: SqlContext,
  columns: Map<string, ColumnMeta> | null
): string {
  const entries = Object.entries(state.updateValues ?? {}).filter(
    ([, value]) => value !== undefined
  );
  if (entries.length === 0) {
    throw new QueryBuilderError("No fields to update", "PGRST102");
  }

  const assignments = entries
    .map(([name, value]) => {
      assertIdentifier(name, "column name");
      return `${qi(name)} = ${addParam(
        ctx,
        prepareWriteValue(value, columns?.get(name))
      )}`;
    })
    .join(", ");

  return `UPDATE ${qualified(state.table)} AS ${qi("__u")} SET ${assignments}${renderWriteWhere(
    state,
    ctx,
    "__u"
  )}`;
}

function renderDelete(state: BuilderState, ctx: SqlContext): string {
  return `DELETE FROM ${qualified(state.table)} AS ${qi("__d")}${renderWriteWhere(
    state,
    ctx,
    "__d"
  )}`;
}

function renderWriteWhere(
  state: BuilderState,
  ctx: SqlContext,
  alias: string
): string {
  const conditions = state.filters
    .filter((spec) => spec.target === null)
    .map((spec) => renderFilterNode(ctx, spec.node, alias, state.table));
  return conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
}

/* ------------------------------------------------------------------ *
 * Builder
 * ------------------------------------------------------------------ */

const SCHEMA_STALE_CODES = new Set(["42P01", "42703", "42883", "42704"]);

export class PostgrestQueryBuilder implements PromiseLike<PostgrestListResponse> {
  private readonly state: BuilderState;
  private promise: Promise<PostgrestListResponse> | null = null;
  /** Błąd nazwy tabeli zgłaszamy przy wykonaniu, żeby `.from()` nigdy nie rzucało. */
  private readonly deferredError: unknown = null;

  constructor(table: string) {
    let ref: TableRef;
    try {
      ref = parseTableRef(table);
    } catch (err) {
      this.deferredError = err;
      ref = { schema: "public", table: "__invalid_table__" };
    }
    this.state = {
      table: ref,
      mode: "select",
      selectString: null,
      returning: false,
      count: null,
      head: false,
      filters: [],
      orders: [],
      limitCount: null,
      offset: null,
      limitTargets: new Map(),
      singleMode: "none",
      values: [],
      updateValues: null,
      onConflict: null,
      ignoreDuplicates: false,
    };
  }

  /* ---------- Operacje ---------- */

  select(columns?: string, options?: SelectOptions): this {
    this.state.selectString = columns && columns.trim().length > 0 ? columns : "*";
    if (this.state.mode !== "select") this.state.returning = true;
    if (options?.count) this.state.count = options.count;
    if (options?.head) this.state.head = true;
    return this;
  }

  insert(values: Row | Row[], options?: { count?: SelectOptions["count"] }): this {
    this.state.mode = "insert";
    this.state.values = Array.isArray(values) ? values : [values];
    if (options?.count) this.state.count = options.count;
    return this;
  }

  upsert(values: Row | Row[], options?: UpsertOptions): this {
    this.state.mode = "upsert";
    this.state.values = Array.isArray(values) ? values : [values];
    this.state.onConflict = options?.onConflict ?? null;
    this.state.ignoreDuplicates = options?.ignoreDuplicates ?? false;
    if (options?.count) this.state.count = options.count;
    return this;
  }

  update(values: Row, options?: { count?: SelectOptions["count"] }): this {
    this.state.mode = "update";
    this.state.updateValues = values;
    if (options?.count) this.state.count = options.count;
    return this;
  }

  delete(options?: { count?: SelectOptions["count"] }): this {
    this.state.mode = "delete";
    if (options?.count) this.state.count = options.count;
    return this;
  }

  /* ---------- Filtry ---------- */

  private addFilter(
    column: string,
    op: FilterOp,
    value: unknown,
    negate = false
  ): this {
    this.state.filters.push({
      target: null,
      node: { kind: "cmp", column, op, value, negate },
    });
    return this;
  }

  eq(column: string, value: unknown): this {
    return this.addFilter(column, "eq", value);
  }

  neq(column: string, value: unknown): this {
    return this.addFilter(column, "neq", value);
  }

  gt(column: string, value: unknown): this {
    return this.addFilter(column, "gt", value);
  }

  gte(column: string, value: unknown): this {
    return this.addFilter(column, "gte", value);
  }

  lt(column: string, value: unknown): this {
    return this.addFilter(column, "lt", value);
  }

  lte(column: string, value: unknown): this {
    return this.addFilter(column, "lte", value);
  }

  like(column: string, pattern: string): this {
    return this.addFilter(column, "like", pattern);
  }

  ilike(column: string, pattern: string): this {
    return this.addFilter(column, "ilike", pattern);
  }

  is(column: string, value: boolean | null): this {
    return this.addFilter(column, "is", value);
  }

  in(column: string, values: readonly unknown[]): this {
    return this.addFilter(column, "in", [...values]);
  }

  contains(column: string, value: unknown): this {
    return this.addFilter(column, "cs", value);
  }

  containedBy(column: string, value: unknown): this {
    return this.addFilter(column, "cd", value);
  }

  overlaps(column: string, value: unknown): this {
    return this.addFilter(column, "ov", value);
  }

  /** Generyczny filtr PostgREST, np. `.filter("status", "eq", "Nowe")`. */
  filter(column: string, operator: string, value: unknown): this {
    const trimmed = operator.trim();
    const negate = /^not\./i.test(trimmed);
    const opRaw = negate ? trimmed.slice(4) : trimmed;
    return this.addFilter(column, normalizeOp(opRaw), value, negate);
  }

  not(column: string, operator: string, value: unknown): this {
    const op = normalizeOp(operator);
    const parsed =
      op === "in" && typeof value === "string" ? parseListLiteral(value) : value;
    return this.addFilter(column, op, parsed, true);
  }

  match(values: Row): this {
    for (const [column, value] of Object.entries(values)) {
      this.addFilter(column, "eq", value);
    }
    return this;
  }

  /** Filtr PostgREST `or`, np. `"a.eq.x,and(b.is.null,c.gt.1)"`. */
  or(filters: string, options?: ReferencedTableOptions): this {
    this.state.filters.push({
      target: options?.referencedTable ?? options?.foreignTable ?? null,
      node: parseLogicString(filters, "or"),
    });
    return this;
  }

  /* ---------- Modyfikatory ---------- */

  order(column: string, options?: OrderOptions): this {
    this.state.orders.push({
      target: options?.referencedTable ?? options?.foreignTable ?? null,
      column,
      ascending: options?.ascending ?? true,
      nullsFirst: options?.nullsFirst ?? null,
    });
    return this;
  }

  limit(count: number, options?: ReferencedTableOptions): this {
    const target = options?.referencedTable ?? options?.foreignTable ?? null;
    if (target) this.state.limitTargets.set(target, count);
    else this.state.limitCount = count;
    return this;
  }

  range(from: number, to: number, options?: ReferencedTableOptions): this {
    const target = options?.referencedTable ?? options?.foreignTable ?? null;
    const count = Math.max(0, to - from + 1);
    if (target) {
      this.state.limitTargets.set(target, count);
      return this;
    }
    this.state.offset = from;
    this.state.limitCount = count;
    return this;
  }

  single(): PromiseLike<PostgrestSingleResponse> {
    this.state.singleMode = "single";
    return this as unknown as PromiseLike<PostgrestSingleResponse>;
  }

  maybeSingle(): PromiseLike<PostgrestSingleResponse> {
    this.state.singleMode = "maybe";
    return this as unknown as PromiseLike<PostgrestSingleResponse>;
  }

  /** Zgodność z supabase-js — typowanie wyniku nie zmienia zapytania. */
  returns(): this {
    return this;
  }

  /* ---------- Wykonanie ---------- */

  private async run(): Promise<InternalResponse> {
    try {
      return await this.runOnce(false);
    } catch (err) {
      const error = toPostgrestError(err);
      // Po migracji katalog w cache może być nieaktualny — odśwież i spróbuj raz.
      if (error.code && SCHEMA_STALE_CODES.has(error.code)) {
        resetSchemaCache();
        try {
          return await this.runOnce(true);
        } catch (retryErr) {
          return this.errorResponse(toPostgrestError(retryErr));
        }
      }
      return this.errorResponse(error);
    }
  }

  private errorResponse(error: PostgrestError): PostgrestFailure {
    const { status, statusText } = statusForError(error);
    return { data: null, error, count: null, status, statusText };
  }

  private async runOnce(isRetry: boolean): Promise<InternalResponse> {
    void isRetry;
    if (this.deferredError) throw this.deferredError;
    const snapshot = await loadSchema();
    const state = this.state;

    const built =
      state.mode === "select"
        ? buildSelectQuery(state, snapshot)
        : buildWriteQuery(state, snapshot);

    const result = await query<Row>(built.rowsText, built.rowsParams);

    if (state.mode !== "select" && !state.returning) {
      return {
        data: null,
        error: null,
        count: state.count ? (result.rowCount ?? 0) : null,
        status: 201,
        statusText: "Created",
      };
    }

    if (state.head) {
      const count = Number(result.rows[0]?.__count ?? 0);
      return {
        data: null,
        error: null,
        count: Number.isFinite(count) ? count : 0,
        status: 200,
        statusText: "OK",
      };
    }

    const rows = result.rows.map((row) => row.__row as Row);
    let count: number | null = null;
    if (state.count) {
      const raw = result.rows[0]?.__count;
      if (raw != null) {
        count = Number(raw);
      } else if (built.countText) {
        const countResult = await query<{ __count: string }>(
          built.countText,
          built.countParams
        );
        count = Number(countResult.rows[0]?.__count ?? 0);
      } else {
        count = rows.length;
      }
      if (count != null && !Number.isFinite(count)) count = 0;
    }

    if (state.singleMode !== "none") {
      if (rows.length > 1) {
        return this.errorResponse({
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "Results contain more than 1 row",
          hint: null,
        });
      }
      if (rows.length === 0 && state.singleMode === "single") {
        return this.errorResponse({
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "The result contains 0 rows",
          hint: null,
        });
      }
      return {
        data: rows.length === 1 ? rows[0] : null,
        error: null,
        count,
        status: 200,
        statusText: "OK",
      };
    }

    return { data: rows, error: null, count, status: 200, statusText: "OK" };
  }

  private execute(): Promise<PostgrestListResponse> {
    if (!this.promise) {
      this.promise = this.run() as Promise<PostgrestListResponse>;
    }
    return this.promise;
  }

  then<TResult1 = PostgrestListResponse, TResult2 = never>(
    onfulfilled?:
      | ((value: PostgrestListResponse) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<PostgrestListResponse | TResult> {
    return this.execute().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<PostgrestListResponse> {
    return this.execute().finally(onfinally);
  }

  /** Podgląd wygenerowanego SQL — przydatne w testach i przy diagnostyce. */
  async toSql(): Promise<{ text: string; params: unknown[] }> {
    if (this.deferredError) throw this.deferredError;
    const snapshot = await loadSchema();
    const built =
      this.state.mode === "select"
        ? buildSelectQuery(this.state, snapshot)
        : buildWriteQuery(this.state, snapshot);
    return { text: built.rowsText, params: built.rowsParams };
  }
}

/** Tworzy builder dla tabeli — odpowiednik `supabase.from(table)`. */
export function createQueryBuilder(table: string): PostgrestQueryBuilder {
  return new PostgrestQueryBuilder(table);
}
