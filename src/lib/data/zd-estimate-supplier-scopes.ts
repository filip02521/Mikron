import { query } from "@/lib/db/pool";
import type { ZdEstimateRunMode } from "@/lib/orders/zd-estimate-scope";

/**
 * Zakres dostawcy w Kreatorze ZD (grupa XOR cecha Subiekta). Dostawca może mieć
 * kilka zakresów — pierwszy (sort_order, potem created_at) jest główny: od niego
 * startuje Kreator i pod nim zapisuje się historia ZD.
 */
export type ZdEstimateSupplierScopeRow = {
  id: string;
  supplierId: string;
  mode: ZdEstimateRunMode;
  grupaId: number | null;
  cechaId: number | null;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
};

type DbRow = {
  id: string;
  supplier_id: string;
  mode: string;
  grupa_id: number | null;
  cecha_id: number | null;
  label: string | null;
  sort_order: number | null;
  created_at: Date | string;
  updated_at: Date | string;
  updated_by: string | null;
};

const SELECT_COLS =
  "id, supplier_id, mode, grupa_id, cecha_id, label, sort_order, created_at, updated_at, updated_by";

/** Główny zakres dostawcy na początku listy. */
const ORDER_BY = "supplier_id, sort_order, created_at, id";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function mapZdEstimateSupplierScopeRow(row: DbRow): ZdEstimateSupplierScopeRow {
  const mode: ZdEstimateRunMode = row.mode === "cecha" ? "cecha" : "grupa";
  return {
    id: row.id,
    supplierId: row.supplier_id,
    mode,
    grupaId: row.grupa_id != null ? Math.trunc(Number(row.grupa_id)) : null,
    cechaId: row.cecha_id != null ? Math.trunc(Number(row.cecha_id)) : null,
    label: (row.label ?? "").trim(),
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    updatedBy: row.updated_by,
  };
}

/** Główny zakres dostawcy (start Kreatora). */
export async function fetchZdEstimateSupplierScope(
  supplierId: string
): Promise<ZdEstimateSupplierScopeRow | null> {
  const rows = await listZdEstimateSupplierScopesFor(supplierId);
  return rows[0] ?? null;
}

/** Wszystkie zakresy dostawcy — główny pierwszy. */
export async function listZdEstimateSupplierScopesFor(
  supplierId: string
): Promise<ZdEstimateSupplierScopeRow[]> {
  const id = supplierId.trim();
  if (!id) return [];
  const res = await query<DbRow>(
    `SELECT ${SELECT_COLS} FROM zd_estimate_supplier_scopes
      WHERE supplier_id = $1 ORDER BY ${ORDER_BY}`,
    [id]
  );
  return res.rows.map(mapZdEstimateSupplierScopeRow);
}

/** Wszystkie zakresy — dostawcami, główny pierwszy u każdego. */
export async function listZdEstimateSupplierScopes(): Promise<ZdEstimateSupplierScopeRow[]> {
  const res = await query<DbRow>(
    `SELECT ${SELECT_COLS} FROM zd_estimate_supplier_scopes ORDER BY ${ORDER_BY}`
  );
  return res.rows.map(mapZdEstimateSupplierScopeRow);
}

/** Grupuje zakresy po dostawcy, zachowując kolejność (główny pierwszy). */
export function groupZdEstimateScopesBySupplier<T extends { supplierId: string }>(
  rows: readonly T[]
): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const list = out.get(row.supplierId) ?? [];
    list.push(row);
    out.set(row.supplierId, list);
  }
  return out;
}

export async function deleteZdEstimateSupplierScope(scopeId: string): Promise<void> {
  const id = scopeId.trim();
  if (!id) throw new Error("Brak identyfikatora zakresu.");
  await query(`DELETE FROM zd_estimate_supplier_scopes WHERE id = $1`, [id]);
}

/**
 * Zapis zakresu: z `scopeId` — zmiana istniejącego, bez — dodanie kolejnego
 * (ten sam zakres drugi raz = odświeżenie etykiety).
 */
export async function upsertZdEstimateSupplierScope(input: {
  scopeId?: string | null;
  supplierId: string;
  mode: ZdEstimateRunMode;
  grupaId?: number | null;
  cechaId?: number | null;
  label?: string | null;
  updatedBy?: string | null;
}): Promise<ZdEstimateSupplierScopeRow> {
  const supplierId = input.supplierId.trim();
  if (!supplierId) throw new Error("Brak supplierId.");

  const mode = input.mode;
  const grupaId = mode === "grupa" ? Math.trunc(Number(input.grupaId)) : null;
  const cechaId = mode === "cecha" ? Math.trunc(Number(input.cechaId)) : null;
  if (mode === "grupa" && !(grupaId != null && grupaId > 0)) {
    throw new Error("Dla trybu grupa wymagane jest grupaId > 0.");
  }
  if (mode === "cecha" && !(cechaId != null && cechaId > 0)) {
    throw new Error("Dla trybu cecha wymagane jest cechaId > 0.");
  }
  const label = (input.label ?? "").trim().slice(0, 200);
  const updatedBy = input.updatedBy ?? null;

  const scopeId = input.scopeId?.trim();
  if (scopeId) {
    const res = await query<DbRow>(
      `UPDATE zd_estimate_supplier_scopes
          SET mode = $3, grupa_id = $4, cecha_id = $5, label = $6,
              updated_at = now(), updated_by = $7
        WHERE id = $1 AND supplier_id = $2
        RETURNING ${SELECT_COLS}`,
      [scopeId, supplierId, mode, grupaId, cechaId, label, updatedBy]
    ).catch((e: unknown) => {
      if ((e as { code?: string }).code === "23505") {
        throw new Error("Ten dostawca ma już ten zakres — usuń duplikat zamiast zmieniać.");
      }
      throw e;
    });
    if (!res.rows[0]) throw new Error("Nie znaleziono zakresu do zmiany.");
    return mapZdEstimateSupplierScopeRow(res.rows[0]);
  }

  const res = await query<DbRow>(
    `INSERT INTO zd_estimate_supplier_scopes
       (supplier_id, mode, grupa_id, cecha_id, label, updated_by, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6,
       COALESCE((SELECT max(sort_order) + 1 FROM zd_estimate_supplier_scopes WHERE supplier_id = $1), 0))
     ON CONFLICT (supplier_id, mode, COALESCE(grupa_id, cecha_id)) DO UPDATE SET
       label = EXCLUDED.label, updated_at = now(), updated_by = EXCLUDED.updated_by
     RETURNING ${SELECT_COLS}`,
    [supplierId, mode, grupaId, cechaId, label, updatedBy]
  );
  return mapZdEstimateSupplierScopeRow(res.rows[0]!);
}

/**
 * Ustawia zakres jako główny dostawcy (od niego startuje Kreator i pod nim
 * zapisuje się historia ZD). Pozostałe zachowują kolejność. Zwraca nową listę.
 */
export async function setPrimaryZdEstimateSupplierScope(
  scopeId: string
): Promise<ZdEstimateSupplierScopeRow[]> {
  const id = scopeId.trim();
  if (!id) throw new Error("Brak identyfikatora zakresu.");
  const res = await query<{ supplier_id: string }>(
    `UPDATE zd_estimate_supplier_scopes s
        SET sort_order = r.rn
       FROM (
         SELECT id, (row_number() OVER (
                  ORDER BY (id = $1) DESC, sort_order, created_at, id
                ) - 1)::int AS rn
           FROM zd_estimate_supplier_scopes
          WHERE supplier_id = (SELECT supplier_id FROM zd_estimate_supplier_scopes WHERE id = $1)
       ) r
      WHERE s.id = r.id
      RETURNING s.supplier_id`,
    [id]
  );
  const supplierId = res.rows[0]?.supplier_id;
  if (!supplierId) throw new Error("Nie znaleziono zakresu.");
  return listZdEstimateSupplierScopesFor(supplierId);
}
