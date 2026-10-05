import { query, withClient } from "@/lib/db/pool";
import type { ZdEstimateSnapshotHostKind } from "@/lib/subiekt/config";
import type { PriceListColumns } from "./price-list";

/** pg zwraca `numeric` jako string. */
function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

function dateKey(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  }
  return String(v).slice(0, 10);
}

export type PriceItemStatus = "not_in_list" | "pending" | "applied" | "changed" | "failed" | "mismatch";

export type PriceListItem = {
  id: number;
  twId: number;
  symbol: string;
  name: string;
  listName: string | null;
  listRow: number | null;
  packFactor: number;
  vatSubiekt: number | null;
  vatList: number | null;
  /** Upust z cennika (%) = docelowa marża. */
  listDiscount: number | null;
  oldPurchase: number | null;
  oldRetail: number | null;
  newPurchase: number | null;
  newRetail: number | null;
  flags: string[];
  selected: boolean;
  status: PriceItemStatus;
  error: string | null;
  afterPurchase: number | null;
  afterRetail: number | null;
  appliedAt: string | null;
};

export type PriceListImport = {
  id: string;
  createdAt: string;
  createdByName: string | null;
  fileName: string;
  cechaId: number;
  cechaName: string;
  hostKind: ZdEstimateSnapshotHostKind;
  validFrom: string | null;
  thresholdPct: number;
  pricelistRows: number;
  pricelistUnmatched: number;
  counts: Record<PriceItemStatus, number> & { selectedPending: number };
};

export type NewPriceListItem = Omit<
  PriceListItem,
  "id" | "status" | "error" | "afterPurchase" | "afterRetail" | "appliedAt"
> & { status: "pending" | "not_in_list" };

export async function insertPriceListImport(input: {
  createdBy: string;
  fileName: string;
  cechaId: number;
  cechaName: string;
  hostKind: ZdEstimateSnapshotHostKind;
  validFrom: string | null;
  thresholdPct: number;
  columns: PriceListColumns;
  pricelistRows: number;
  pricelistUnmatched: number;
  items: NewPriceListItem[];
}): Promise<string> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO price_list_imports
           (created_by, file_name, cecha_id, cecha_name, host_kind, valid_from, threshold_pct, column_map,
            pricelist_rows, pricelist_unmatched)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          input.createdBy,
          input.fileName,
          input.cechaId,
          input.cechaName,
          input.hostKind,
          input.validFrom,
          input.thresholdPct,
          JSON.stringify(input.columns),
          input.pricelistRows,
          input.pricelistUnmatched,
        ]
      );
      const id = rows[0]!.id;
      const it = input.items;
      await client.query(
        `INSERT INTO price_list_items
           (import_id, tw_id, tw_symbol, tw_name, pl_name, pl_row, pack_factor, vat_subiekt, vat_list, list_discount,
            old_purchase, old_retail, new_purchase, new_retail, flags, selected, status)
         SELECT $1, t.tw_id, t.tw_symbol, t.tw_name, t.pl_name, t.pl_row, t.pack_factor, t.vat_subiekt, t.vat_list, t.list_discount,
                t.old_purchase, t.old_retail, t.new_purchase, t.new_retail,
                string_to_array(t.flags, ',', ''), t.selected, t.status
         FROM unnest($2::int[], $3::text[], $4::text[], $5::text[], $6::int[], $7::int[], $8::numeric[], $9::numeric[],
                     $10::numeric[], $11::numeric[], $12::numeric[], $13::numeric[], $14::text[], $15::bool[], $16::text[], $17::numeric[])
           AS t(tw_id, tw_symbol, tw_name, pl_name, pl_row, pack_factor, vat_subiekt, vat_list,
                old_purchase, old_retail, new_purchase, new_retail, flags, selected, status, list_discount)`,
        [
          id,
          it.map((i) => i.twId),
          it.map((i) => i.symbol),
          it.map((i) => i.name),
          it.map((i) => i.listName),
          it.map((i) => i.listRow),
          it.map((i) => i.packFactor),
          it.map((i) => i.vatSubiekt),
          it.map((i) => i.vatList),
          it.map((i) => i.oldPurchase),
          it.map((i) => i.oldRetail),
          it.map((i) => i.newPurchase),
          it.map((i) => i.newRetail),
          it.map((i) => i.flags.join(",")),
          it.map((i) => i.selected),
          it.map((i) => i.status),
          it.map((i) => i.listDiscount),
        ]
      );
      await client.query("COMMIT");
      return id;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

const COUNTS_SQL = `
  (SELECT jsonb_build_object(
     'not_in_list', count(*) FILTER (WHERE i.status = 'not_in_list'),
     'pending', count(*) FILTER (WHERE i.status = 'pending'),
     'applied', count(*) FILTER (WHERE i.status = 'applied'),
     'changed', count(*) FILTER (WHERE i.status = 'changed'),
     'failed', count(*) FILTER (WHERE i.status = 'failed'),
     'mismatch', count(*) FILTER (WHERE i.status = 'mismatch'),
     'selectedPending', count(*) FILTER (WHERE i.status = 'pending' AND i.selected))
   FROM price_list_items i WHERE i.import_id = p.id) AS counts`;

type ImportRow = {
  id: string;
  created_at: unknown;
  created_by_name: string | null;
  file_name: string;
  cecha_id: number;
  cecha_name: string;
  host_kind: ZdEstimateSnapshotHostKind;
  valid_from: unknown;
  threshold_pct: unknown;
  pricelist_rows: number;
  pricelist_unmatched: number;
  counts: PriceListImport["counts"];
};

function importFromRow(r: ImportRow): PriceListImport {
  return {
    id: r.id,
    createdAt: iso(r.created_at),
    createdByName: r.created_by_name,
    fileName: r.file_name,
    cechaId: r.cecha_id,
    cechaName: r.cecha_name,
    hostKind: r.host_kind,
    validFrom: dateKey(r.valid_from),
    thresholdPct: numOrNull(r.threshold_pct) ?? 5,
    pricelistRows: r.pricelist_rows,
    pricelistUnmatched: r.pricelist_unmatched,
    counts: r.counts,
  };
}

const IMPORT_SELECT = `
  SELECT p.*, pr.email AS created_by_name, ${COUNTS_SQL}
  FROM price_list_imports p
  LEFT JOIN profiles pr ON pr.id = p.created_by`;

export async function listPriceListImports(limit = 30): Promise<PriceListImport[]> {
  const { rows } = await query<ImportRow>(`${IMPORT_SELECT} ORDER BY p.created_at DESC LIMIT $1`, [limit]);
  return rows.map(importFromRow);
}

export async function getPriceListImport(id: string): Promise<PriceListImport | null> {
  const { rows } = await query<ImportRow>(`${IMPORT_SELECT} WHERE p.id = $1`, [id]);
  return rows[0] ? importFromRow(rows[0]) : null;
}

type ItemRow = {
  id: string;
  tw_id: number;
  tw_symbol: string;
  tw_name: string;
  pl_name: string | null;
  pl_row: number | null;
  pack_factor: number;
  vat_subiekt: unknown;
  vat_list: unknown;
  list_discount: unknown;
  old_purchase: unknown;
  old_retail: unknown;
  new_purchase: unknown;
  new_retail: unknown;
  flags: string[];
  selected: boolean;
  status: PriceItemStatus;
  error: string | null;
  after_purchase: unknown;
  after_retail: unknown;
  applied_at: unknown;
};

function itemFromRow(r: ItemRow): PriceListItem {
  return {
    id: Number(r.id),
    twId: r.tw_id,
    symbol: r.tw_symbol,
    name: r.tw_name,
    listName: r.pl_name,
    listRow: r.pl_row,
    packFactor: r.pack_factor,
    vatSubiekt: numOrNull(r.vat_subiekt),
    vatList: numOrNull(r.vat_list),
    listDiscount: numOrNull(r.list_discount),
    oldPurchase: numOrNull(r.old_purchase),
    oldRetail: numOrNull(r.old_retail),
    newPurchase: numOrNull(r.new_purchase),
    newRetail: numOrNull(r.new_retail),
    flags: r.flags ?? [],
    selected: r.selected,
    status: r.status,
    error: r.error,
    afterPurchase: numOrNull(r.after_purchase),
    afterRetail: numOrNull(r.after_retail),
    appliedAt: r.applied_at == null ? null : iso(r.applied_at),
  };
}

export async function listPriceListItems(importId: string): Promise<PriceListItem[]> {
  const { rows } = await query<ItemRow>(
    `SELECT * FROM price_list_items WHERE import_id = $1 ORDER BY tw_symbol`,
    [importId]
  );
  return rows.map(itemFromRow);
}

/** Zaznaczenie tylko dla pozycji jeszcze nie zapisanych. */
export async function setPriceItemsSelected(importId: string, ids: number[], selected: boolean): Promise<void> {
  await query(
    `UPDATE price_list_items SET selected = $3
     WHERE import_id = $1 AND id = ANY($2::bigint[]) AND status = 'pending'`,
    [importId, ids, selected]
  );
}

export async function nextSelectedPending(importId: string, limit: number): Promise<PriceListItem[]> {
  const { rows } = await query<ItemRow>(
    `SELECT * FROM price_list_items
     WHERE import_id = $1 AND status = 'pending' AND selected
     ORDER BY tw_symbol LIMIT $2`,
    [importId, limit]
  );
  return rows.map(itemFromRow);
}

export async function finishPriceItem(input: {
  id: number;
  status: Exclude<PriceItemStatus, "pending" | "not_in_list">;
  error: string | null;
  afterPurchase: number | null;
  afterRetail: number | null;
  appliedBy: string;
}): Promise<void> {
  await query(
    `UPDATE price_list_items
     SET status = $2, error = $3, after_purchase = $4, after_retail = $5, applied_at = now(), applied_by = $6
     WHERE id = $1 AND status = 'pending'`,
    [input.id, input.status, input.error, input.afterPurchase, input.afterRetail, input.appliedBy]
  );
}

/** Błąd sieci / Sfery → z powrotem do kolejki; przed zapisem i tak sprawdzamy, czy cena się nie zmieniła. */
export async function retryFailedPriceItems(importId: string): Promise<number> {
  const { rowCount } = await query(
    `UPDATE price_list_items
     SET status = 'pending', error = NULL, after_purchase = NULL, after_retail = NULL, applied_at = NULL, applied_by = NULL
     WHERE import_id = $1 AND status = 'failed'`,
    [importId]
  );
  return rowCount ?? 0;
}
