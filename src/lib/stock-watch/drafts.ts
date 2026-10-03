import { query, withClient } from "@/lib/db/pool";

import {
  type PurchaseDraft,
  type PurchaseDraftStatus,
  type PurchaseDraftSummary,
} from "@/lib/stock-watch/drafts-shared";

export {
  purchaseDraftTotals,
  type PurchaseDraft,
  type PurchaseDraftLine,
  type PurchaseDraftStatus,
  type PurchaseDraftSummary,
} from "@/lib/stock-watch/drafts-shared";

type Row = Record<string, unknown>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function numOrNull(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getPurchaseDraft(id: string): Promise<PurchaseDraft | null> {
  const head = await query<Row>(
    `SELECT d.*, s.name AS supplier_name
       FROM purchase_order_drafts d
       JOIN suppliers s ON s.id = d.supplier_id
      WHERE d.id = $1`,
    [id]
  );
  const row = head.rows[0];
  if (!row) return null;
  const lines = await query<Row>(
    `SELECT * FROM purchase_order_draft_lines
      WHERE draft_id = $1
      ORDER BY sort_order, tw_symbol NULLS LAST, subiekt_tw_id`,
    [id]
  );
  return {
    id: String(row.id),
    supplierId: String(row.supplier_id),
    supplierName: String(row.supplier_name ?? ""),
    status: row.status as PurchaseDraftStatus,
    note: String(row.note ?? ""),
    zdDokId: numOrNull(row.zd_dok_id),
    zdDokNr: (row.zd_dok_nr as string | null) ?? null,
    submittedAt: iso(row.submitted_at),
    createdAt: iso(row.created_at) ?? "",
    updatedAt: iso(row.updated_at) ?? "",
    lines: lines.rows.map((l) => ({
      id: String(l.id),
      subiektTwId: num(l.subiekt_tw_id),
      twSymbol: (l.tw_symbol as string | null) ?? null,
      twNazwa: String(l.tw_nazwa ?? ""),
      qty: num(l.qty),
      suggestedQty: num(l.suggested_qty),
      unitPriceNet: numOrNull(l.unit_price_net),
      sortOrder: num(l.sort_order),
    })),
  };
}

export async function listPurchaseDrafts(input: {
  statuses: PurchaseDraftStatus[];
  limit?: number;
}): Promise<PurchaseDraftSummary[]> {
  const res = await query<Row>(
    `SELECT d.id, d.supplier_id, s.name AS supplier_name, d.status, d.zd_dok_nr, d.updated_at,
            count(l.id)::int AS line_count,
            COALESCE(sum(l.qty * l.unit_price_net), 0) AS total_value,
            count(l.unit_price_net)::int AS priced_line_count
       FROM purchase_order_drafts d
       JOIN suppliers s ON s.id = d.supplier_id
       LEFT JOIN purchase_order_draft_lines l ON l.draft_id = d.id
      WHERE d.status = ANY($1::text[])
      GROUP BY d.id, s.name
      ORDER BY d.updated_at DESC
      LIMIT $2`,
    [input.statuses, input.limit ?? 50]
  );
  return res.rows.map((r) => ({
    id: String(r.id),
    supplierId: String(r.supplier_id),
    supplierName: String(r.supplier_name ?? ""),
    status: r.status as PurchaseDraftStatus,
    lineCount: num(r.line_count),
    totalValue: Math.round(num(r.total_value) * 100) / 100,
    pricedLineCount: num(r.priced_line_count),
    zdDokNr: (r.zd_dok_nr as string | null) ?? null,
    updatedAt: iso(r.updated_at) ?? "",
  }));
}

/**
 * Otwarty szkic dostawcy albo nowy z bieżącymi propozycjami (tylko „Standard”,
 * propozycja > 0). Istniejący szkic nie jest nadpisywany — edycje użytkownika zostają.
 */
export async function openOrCreatePurchaseDraft(input: {
  supplierId: string;
  createdBy: string | null;
}): Promise<{ id: string; created: boolean; lineCount: number }> {
  return withClient(async (client) => {
    await client.query("BEGIN");
    try {
      // Serializacja „Przygotuj zamówienie” dla tego dostawcy (dwa kliknięcia = jeden szkic).
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `purchase_draft:${input.supplierId}`,
      ]);
      const existing = await client.query<Row>(
        `SELECT d.id, (SELECT count(*)::int FROM purchase_order_draft_lines l WHERE l.draft_id = d.id) AS n
           FROM purchase_order_drafts d
          WHERE d.supplier_id = $1 AND d.status = 'draft'`,
        [input.supplierId]
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return {
          id: String(existing.rows[0].id),
          created: false,
          lineCount: num(existing.rows[0].n),
        };
      }

      const runRes = await client.query<Row>(
        `SELECT run_id FROM stock_watch_items WHERE supplier_id = $1 AND run_id IS NOT NULL
          ORDER BY computed_at DESC LIMIT 1`,
        [input.supplierId]
      );
      const draft = await client.query<Row>(
        `INSERT INTO purchase_order_drafts (supplier_id, created_by, source_run_id)
         VALUES ($1, $2, $3) RETURNING id`,
        [input.supplierId, input.createdBy, runRes.rows[0]?.run_id ?? null]
      );
      const draftId = String(draft.rows[0]!.id);

      const inserted = await client.query(
        `INSERT INTO purchase_order_draft_lines
           (draft_id, subiekt_tw_id, tw_symbol, tw_nazwa, qty, suggested_qty, unit_price_net, sort_order)
         SELECT $1, i.subiekt_tw_id, i.tw_symbol, i.tw_nazwa, i.suggested_qty, i.suggested_qty,
                i.unit_price_net,
                row_number() OVER (
                  ORDER BY CASE i.status
                    WHEN 'out_of_stock' THEN 0 WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
                  i.days_of_cover NULLS LAST, i.velocity_daily DESC)
           FROM stock_watch_items i
           LEFT JOIN zd_estimate_exclusions e ON e.subiekt_tw_id = i.subiekt_tw_id
           LEFT JOIN zd_estimate_on_request r ON r.subiekt_tw_id = i.subiekt_tw_id
          WHERE i.supplier_id = $2
            AND i.suggested_qty > 0
            AND e.subiekt_tw_id IS NULL
            AND r.subiekt_tw_id IS NULL`,
        [draftId, input.supplierId]
      );
      await client.query("COMMIT");
      return { id: draftId, created: true, lineCount: inserted.rowCount ?? 0 };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
}

async function assertDraftEditable(draftId: string): Promise<void> {
  const res = await query<Row>(`SELECT status FROM purchase_order_drafts WHERE id = $1`, [draftId]);
  const status = res.rows[0]?.status;
  if (!status) throw new Error("Szkic nie istnieje.");
  if (status !== "draft") throw new Error("Szkic jest już zamknięty — edycja niemożliwa.");
}

async function touchDraft(draftId: string): Promise<void> {
  await query(`UPDATE purchase_order_drafts SET updated_at = now() WHERE id = $1`, [draftId]);
}

export async function setPurchaseDraftLineQty(input: {
  draftId: string;
  subiektTwId: number;
  qty: number;
}): Promise<void> {
  await assertDraftEditable(input.draftId);
  const qty = Math.ceil(Number(input.qty));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Ilość musi być większa od 0 (żeby usunąć pozycję, użyj „Usuń”).");
  }
  if (qty > 1_000_000) throw new Error("Ilość poza zakresem.");
  await query(
    `UPDATE purchase_order_draft_lines SET qty = $3, updated_at = now()
      WHERE draft_id = $1 AND subiekt_tw_id = $2`,
    [input.draftId, input.subiektTwId, qty]
  );
  await touchDraft(input.draftId);
}

export async function removePurchaseDraftLine(input: {
  draftId: string;
  subiektTwId: number;
}): Promise<void> {
  await assertDraftEditable(input.draftId);
  await query(
    `DELETE FROM purchase_order_draft_lines WHERE draft_id = $1 AND subiekt_tw_id = $2`,
    [input.draftId, input.subiektTwId]
  );
  await touchDraft(input.draftId);
}

/** Dodaje towar dostawcy z wyników analizy (ilość = propozycja albo 1). */
export async function addPurchaseDraftLine(input: {
  draftId: string;
  subiektTwId: number;
}): Promise<void> {
  await assertDraftEditable(input.draftId);
  const res = await query(
    `INSERT INTO purchase_order_draft_lines
       (draft_id, subiekt_tw_id, tw_symbol, tw_nazwa, qty, suggested_qty, unit_price_net, sort_order)
     SELECT d.id, i.subiekt_tw_id, i.tw_symbol, i.tw_nazwa,
            GREATEST(i.suggested_qty, 1), i.suggested_qty, i.unit_price_net,
            COALESCE((SELECT max(sort_order) + 1 FROM purchase_order_draft_lines WHERE draft_id = d.id), 1)
       FROM purchase_order_drafts d
       JOIN stock_watch_items i ON i.supplier_id = d.supplier_id AND i.subiekt_tw_id = $2
      WHERE d.id = $1
     ON CONFLICT (draft_id, subiekt_tw_id) DO NOTHING`,
    [input.draftId, input.subiektTwId]
  );
  if (!res.rowCount) {
    throw new Error("Towar nie należy do zakresu tego dostawcy albo już jest w szkicu.");
  }
  await touchDraft(input.draftId);
}

export async function setPurchaseDraftNote(input: { draftId: string; note: string }): Promise<void> {
  await assertDraftEditable(input.draftId);
  await query(`UPDATE purchase_order_drafts SET note = $2, updated_at = now() WHERE id = $1`, [
    input.draftId,
    input.note.trim().slice(0, 1000),
  ]);
}

export async function cancelPurchaseDraft(draftId: string): Promise<void> {
  await query(
    `UPDATE purchase_order_drafts SET status = 'cancelled', updated_at = now()
      WHERE id = $1 AND status = 'draft'`,
    [draftId]
  );
}

/**
 * Zamyka szkic po utworzeniu ZD. Warunek `status = 'draft'` — drugi submit
 * (np. podwójne kliknięcie) nie nadpisze numeru dokumentu.
 */
export async function markPurchaseDraftSubmitted(input: {
  draftId: string;
  zdDokId: number;
  zdDokNr: string | null;
  submittedBy: string | null;
}): Promise<boolean> {
  const res = await query(
    `UPDATE purchase_order_drafts
        SET status = 'submitted', zd_dok_id = $2, zd_dok_nr = $3,
            submitted_at = now(), submitted_by = $4, updated_at = now()
      WHERE id = $1 AND status = 'draft'`,
    [input.draftId, input.zdDokId, input.zdDokNr, input.submittedBy]
  );
  return (res.rowCount ?? 0) > 0;
}

/** Towary dostawcy z analizy, których nie ma w szkicu — do „Dodaj pozycję”. */
export async function listDraftAddableItems(draftId: string): Promise<
  { subiektTwId: number; twSymbol: string | null; twNazwa: string; suggestedQty: number; status: string }[]
> {
  const res = await query<Row>(
    `SELECT i.subiekt_tw_id, i.tw_symbol, i.tw_nazwa, i.suggested_qty, i.status
       FROM purchase_order_drafts d
       JOIN stock_watch_items i ON i.supplier_id = d.supplier_id
       LEFT JOIN purchase_order_draft_lines l
         ON l.draft_id = d.id AND l.subiekt_tw_id = i.subiekt_tw_id
       LEFT JOIN zd_estimate_exclusions e ON e.subiekt_tw_id = i.subiekt_tw_id
      WHERE d.id = $1 AND l.id IS NULL AND e.subiekt_tw_id IS NULL
      ORDER BY i.velocity_daily DESC, i.tw_symbol
      LIMIT 500`,
    [draftId]
  );
  return res.rows.map((r) => ({
    subiektTwId: num(r.subiekt_tw_id),
    twSymbol: (r.tw_symbol as string | null) ?? null,
    twNazwa: String(r.tw_nazwa ?? ""),
    suggestedQty: num(r.suggested_qty),
    status: String(r.status),
  }));
}
