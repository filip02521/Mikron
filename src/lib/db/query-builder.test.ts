import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("./pool", () => ({ query: queryMock }));

import {
  ROW_CAP_EXCEEDED_CODE,
  createQueryBuilder,
  resetSchemaCache,
} from "./query-builder";

const CATALOG = {
  rows: [
    { schema_name: "public", table_name: "items", column_name: "id", type_name: "int4", type_category: "N" },
    { schema_name: "public", table_name: "items", column_name: "name", type_name: "text", type_category: "S" },
  ],
};

/** Zwraca `n` wierszy na zapytanie o dane; katalog schematu stały. */
function serveRows(n: number) {
  const sql: string[] = [];
  queryMock.mockImplementation(async (text: string) => {
    if (text.includes("pg_attribute a")) return CATALOG;
    if (text.includes("pg_constraint")) return { rows: [] };
    sql.push(text);
    return {
      rows: Array.from({ length: n }, (_, i) => ({ __row: { id: i, name: `r${i}` } })),
      rowCount: n,
    };
  });
  return sql;
}

describe("query-builder: niejawny limit wierszy", () => {
  beforeEach(() => {
    queryMock.mockReset();
    resetSchemaCache();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("bez jawnego limitu prosi o DB_MAX_ROWS+1 i zwraca błąd, gdy przyjdzie nadmiar", async () => {
    const sql = serveRows(1001);
    const res = await createQueryBuilder("items").select("id, name");
    expect(sql[0]).toMatch(/LIMIT 1001$/);
    expect(res.data).toBeNull();
    expect(res.error?.code).toBe(ROW_CAP_EXCEEDED_CODE);
  });

  it("dokładnie DB_MAX_ROWS wierszy to jeszcze poprawny wynik", async () => {
    serveRows(1000);
    const res = await createQueryBuilder("items").select("id, name");
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1000);
  });

  it("jawne .limit() i .range() nie są pilnowane", async () => {
    const sql = serveRows(5);
    const limited = await createQueryBuilder("items").select("id").limit(5);
    const ranged = await createQueryBuilder("items").select("id").range(0, 4);
    expect(sql[0]).toMatch(/LIMIT 5$/);
    expect(sql[1]).toMatch(/LIMIT 5$/);
    expect(limited.error).toBeNull();
    expect(ranged.error).toBeNull();
  });

  it("maybeSingle i head:true nie dostają limitu +1", async () => {
    const sql = serveRows(1);
    await createQueryBuilder("items").select("id").maybeSingle();
    expect(sql[0]).toMatch(/LIMIT 2$/);
    queryMock.mockClear();
    serveRows(0);
    const head = await createQueryBuilder("items").select("id", { count: "exact", head: true });
    expect(head.error).toBeNull();
  });
});
