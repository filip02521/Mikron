// @service-role-ok — wywoływane ze strony i akcji po requireOperations() + rola admin/zakupy, oraz z crona.
/**
 * Zgłoszenia ROL — zapis i odczyt (migracja 204). Reguły w `scan.ts` / `merge.ts`.
 */
import type { PoolClient } from "pg";
import { query, withClient } from "@/lib/db/pool";
import {
  getSubiektDocument,
  getSubiektOrdersFs,
  searchSubiektDocuments,
  searchSubiektOrdersFs,
} from "@/lib/subiekt/api";
import { loadIvoclarTwIds } from "./ivoclar-products";
import { decideRolMerge, type RolBatchStatus } from "./merge";
import type { RolProgramValues } from "./program";
import { ROL_CONFLICT_REASON, scanRolPeriod, type RolBatchDraft, type RolScanResult } from "./scan";

export type RolProgram = RolProgramValues & { id: string; sendMode: "review" | "auto" };

export type RolInvoiceView = {
  fsDokId: number;
  fsNr: string;
  fsDate: string | null;
  otherLinesCount: number;
  kfsDokIds: number[];
  excluded: boolean;
  excludedReason: string;
};

export type RolLineView = {
  id: number;
  fsDokId: number;
  twId: number;
  symbol: string;
  ivoclarCatalogNo: string | null;
  name: string;
  qtyFs: number;
  qtyKfs: number;
  qtyOverride: number | null;
  excluded: boolean;
};

export type RolBatchView = {
  id: string;
  programId: string;
  period: string;
  status: RolBatchStatus;
  scannedAt: string;
  fsCheckedCount: number;
  changeNote: string;
  lateFsCount: number;
  reviewedAt: string | null;
  zdNr: string | null;
  invoices: RolInvoiceView[];
  lines: RolLineView[];
};

type ProgramRow = {
  id: string;
  label: string;
  file_label: string;
  kh_ids: number[];
  discount_pct: string;
  address_lines: string[];
  nip: string;
  to_emails: string[];
  cc_emails: string[];
  send_mode: "review" | "auto";
  active_from: string;
  active_to: string | null;
};

const toProgram = (r: ProgramRow): RolProgram => ({
  id: r.id,
  label: r.label,
  fileLabel: r.file_label,
  khIds: r.kh_ids.map(Number),
  discountPct: Number(r.discount_pct),
  addressLines: r.address_lines,
  nip: r.nip,
  toEmails: r.to_emails,
  ccEmails: r.cc_emails,
  sendMode: r.send_mode,
  activeFrom: r.active_from,
  activeTo: r.active_to,
});

export async function loadRolPrograms(): Promise<RolProgram[]> {
  const res = await query<ProgramRow>(
    `SELECT id, label, file_label, kh_ids, discount_pct::text, address_lines, nip, to_emails, cc_emails, send_mode,
            to_char(active_from, 'YYYY-MM-DD') AS active_from, to_char(active_to, 'YYYY-MM-DD') AS active_to
       FROM rol_programs ORDER BY label`
  );
  return res.rows.map(toProgram);
}

export async function saveRolProgram(v: RolProgramValues, userId: string): Promise<string> {
  const params = [
    v.label,
    v.fileLabel,
    v.khIds,
    v.discountPct,
    v.addressLines,
    v.nip,
    v.toEmails,
    v.ccEmails,
    v.activeFrom,
    v.activeTo,
    userId,
  ];
  if (v.id) {
    const res = await query<{ id: string }>(
      `UPDATE rol_programs SET label = $1, file_label = $2, kh_ids = $3, discount_pct = $4, address_lines = $5, nip = $6,
              to_emails = $7, cc_emails = $8, active_from = $9, active_to = $10, updated_by = $11, updated_at = now()
        WHERE id = $12 RETURNING id`,
      [...params, v.id]
    );
    if (!res.rows[0]) throw new Error("Nie znaleziono klienta ROL — odśwież stronę.");
    return res.rows[0].id;
  }
  const res = await query<{ id: string }>(
    `INSERT INTO rol_programs (label, file_label, kh_ids, discount_pct, address_lines, nip, to_emails, cc_emails,
                               active_from, active_to, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    params
  );
  return res.rows[0]!.id;
}

/** Paczki miesiąca z FS i pozycjami. */
export async function loadRolBatches(period: string): Promise<RolBatchView[]> {
  const batches = await query<{
    id: string;
    program_id: string;
    period: string;
    status: RolBatchStatus;
    scanned_at: string;
    fs_checked_count: number;
    change_note: string;
    late_fs_count: number;
    reviewed_at: string | null;
    zd_nr: string | null;
  }>(
    `SELECT id, program_id, to_char(period, 'YYYY-MM-DD') AS period, status, scanned_at::text, fs_checked_count,
            change_note, late_fs_count, reviewed_at::text, zd_nr
       FROM rol_batches WHERE period = $1::date`,
    [period]
  );
  if (!batches.rows.length) return [];
  const ids = batches.rows.map((b) => b.id);
  const [invoices, lines] = await Promise.all([
    query<{
      batch_id: string;
      fs_dok_id: number;
      fs_nr: string;
      fs_date: string | null;
      other_lines_count: number;
      kfs_dok_ids: number[];
      excluded: boolean;
      excluded_reason: string;
    }>(
      `SELECT batch_id, fs_dok_id, fs_nr, to_char(fs_date, 'YYYY-MM-DD') AS fs_date, other_lines_count, kfs_dok_ids,
              excluded, excluded_reason
         FROM rol_batch_invoices WHERE batch_id = ANY($1::uuid[]) ORDER BY fs_date NULLS LAST, fs_dok_id`,
      [ids]
    ),
    query<{
      id: string;
      batch_id: string;
      fs_dok_id: number;
      subiekt_tw_id: number;
      symbol: string;
      ivoclar_catalog_no: string | null;
      name: string;
      qty_fs: string;
      qty_kfs: string;
      qty_override: string | null;
      excluded: boolean;
    }>(
      `SELECT id::text, batch_id, fs_dok_id, subiekt_tw_id, symbol, ivoclar_catalog_no, name, qty_fs::text, qty_kfs::text,
              qty_override::text, excluded
         FROM rol_batch_lines WHERE batch_id = ANY($1::uuid[]) ORDER BY id`,
      [ids]
    ),
  ]);
  return batches.rows.map((b) => ({
    id: b.id,
    programId: b.program_id,
    period: b.period,
    status: b.status,
    scannedAt: b.scanned_at,
    fsCheckedCount: b.fs_checked_count,
    changeNote: b.change_note,
    lateFsCount: b.late_fs_count,
    reviewedAt: b.reviewed_at,
    zdNr: b.zd_nr,
    invoices: invoices.rows
      .filter((i) => i.batch_id === b.id)
      .map((i) => ({
        fsDokId: i.fs_dok_id,
        fsNr: i.fs_nr,
        fsDate: i.fs_date,
        otherLinesCount: i.other_lines_count,
        kfsDokIds: i.kfs_dok_ids,
        excluded: i.excluded,
        excludedReason: i.excluded_reason,
      })),
    lines: lines.rows
      .filter((l) => l.batch_id === b.id)
      .map((l) => ({
        id: Number(l.id),
        fsDokId: l.fs_dok_id,
        twId: l.subiekt_tw_id,
        symbol: l.symbol,
        ivoclarCatalogNo: l.ivoclar_catalog_no,
        name: l.name,
        qtyFs: Number(l.qty_fs),
        qtyKfs: Number(l.qty_kfs),
        qtyOverride: l.qty_override === null ? null : Number(l.qty_override),
        excluded: l.excluded,
      })),
  }));
}

/**
 * Podmiana FS i pozycji paczki z zachowaniem decyzji użytkownika (wyłączenia, ręczne ilości)
 * dla FS i towarów, które zostały. Wyłączenie „do decyzji” liczy skan na nowo.
 */
async function replaceBatchContent(db: PoolClient, batchId: string, draft: RolBatchDraft): Promise<void> {
  const keptInvoices = await db.query<{ fs_dok_id: number; excluded_reason: string }>(
    `SELECT fs_dok_id, excluded_reason FROM rol_batch_invoices WHERE batch_id = $1 AND excluded AND excluded_reason <> $2`,
    [batchId, ROL_CONFLICT_REASON]
  );
  const userExcluded = new Map(keptInvoices.rows.map((r) => [r.fs_dok_id, r.excluded_reason]));
  const keptLines = await db.query<{ fs_dok_id: number; subiekt_tw_id: number; qty_override: string | null; excluded: boolean; note: string }>(
    `SELECT fs_dok_id, subiekt_tw_id, qty_override::text, excluded, note FROM rol_batch_lines
      WHERE batch_id = $1 AND (excluded OR qty_override IS NOT NULL OR note <> '')`,
    [batchId]
  );
  const lineKey = (fs: number, tw: number) => `${fs}:${tw}`;
  const userLines = new Map(keptLines.rows.map((r) => [lineKey(r.fs_dok_id, r.subiekt_tw_id), r]));

  await db.query(`DELETE FROM rol_batch_lines WHERE batch_id = $1`, [batchId]);
  await db.query(`DELETE FROM rol_batch_invoices WHERE batch_id = $1`, [batchId]);
  for (const inv of draft.invoices) {
    const userReason = userExcluded.get(inv.fsDokId);
    await db.query(
      `INSERT INTO rol_batch_invoices (batch_id, fs_dok_id, fs_nr, fs_date, other_lines_count, kfs_dok_ids, excluded, excluded_reason)
       VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8)`,
      [
        batchId,
        inv.fsDokId,
        inv.fsNr,
        inv.fsDate,
        inv.otherLinesCount,
        inv.kfsDokIds,
        inv.excluded || userReason !== undefined,
        inv.excluded ? inv.excludedReason : (userReason ?? ""),
      ]
    );
  }
  for (const l of draft.lines) {
    const user = userLines.get(lineKey(l.fsDokId, l.twId));
    await db.query(
      `INSERT INTO rol_batch_lines (batch_id, fs_dok_id, subiekt_tw_id, symbol, ivoclar_catalog_no, name, qty_fs, qty_kfs,
                                    qty_override, excluded, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        batchId,
        l.fsDokId,
        l.twId,
        l.symbol,
        l.ivoclarCatalogNo,
        l.name,
        l.qtyFs,
        l.qtyKfs,
        user?.qty_override ?? null,
        user?.excluded ?? false,
        user?.note ?? "",
      ]
    );
  }
}

/** Zapis wyniku skanu: każda paczka w osobnej transakcji, decyzja z `decideRolMerge`. */
export async function saveRolScan(result: RolScanResult): Promise<{ changed: number }> {
  let changed = 0;
  for (const draft of result.drafts) {
    await withClient(async (db) => {
      await db.query("BEGIN");
      try {
        const existing = await db.query<{ id: string; status: RolBatchStatus; content_hash: string }>(
          `SELECT id, status, content_hash FROM rol_batches WHERE program_id = $1 AND period = $2::date FOR UPDATE`,
          [draft.programId, result.period]
        );
        const row = existing.rows[0] ?? null;
        const fsIds = row
          ? (await db.query<{ fs_dok_id: number }>(`SELECT fs_dok_id FROM rol_batch_invoices WHERE batch_id = $1`, [row.id])).rows.map(
              (r) => r.fs_dok_id
            )
          : [];
        const decision = decideRolMerge(row ? { status: row.status, contentHash: row.content_hash, fsDokIds: fsIds } : null, draft);
        if (decision.kind === "touch") {
          await db.query(`UPDATE rol_batches SET scanned_at = now(), fs_checked_count = $2 WHERE id = $1`, [row!.id, result.fsChecked]);
        } else if (decision.kind === "late") {
          await db.query(`UPDATE rol_batches SET scanned_at = now(), fs_checked_count = $2, late_fs_count = $3 WHERE id = $1`, [
            row!.id,
            result.fsChecked,
            decision.lateFsCount,
          ]);
          if (decision.lateFsCount > 0) changed += 1;
        } else {
          const batchId = row
            ? row.id
            : (
                await db.query<{ id: string }>(`INSERT INTO rol_batches (program_id, period) VALUES ($1, $2::date) RETURNING id`, [
                  draft.programId,
                  result.period,
                ])
              ).rows[0]!.id;
          await db.query(
            `UPDATE rol_batches SET status = $2, scanned_at = now(), fs_checked_count = $3, content_hash = $4, change_note = $5,
                    reviewed_by = CASE WHEN $6 THEN NULL ELSE reviewed_by END,
                    reviewed_at = CASE WHEN $6 THEN NULL ELSE reviewed_at END
              WHERE id = $1`,
            [batchId, decision.status, result.fsChecked, draft.contentHash, decision.changeNote, decision.clearReview]
          );
          await replaceBatchContent(db, batchId, draft);
          changed += 1;
        }
        await db.query("COMMIT");
      } catch (e) {
        await db.query("ROLLBACK");
        throw e;
      }
    });
  }
  return { changed };
}

/** Skan miesiąca w Subiekcie (host ORDERS) i zapis paczek. */
export async function runRolScan(input: { period: string; todayKey: string }): Promise<{ fsChecked: number; programs: number; changed: number }> {
  const programs = await loadRolPrograms();
  if (!programs.length) return { fsChecked: 0, programs: 0, changed: 0 };
  const result = await scanRolPeriod(
    {
      listFs: searchSubiektOrdersFs,
      getFs: getSubiektOrdersFs,
      listDocuments: searchSubiektDocuments,
      getDocument: getSubiektDocument,
      loadIvoclarTwIds,
    },
    { period: input.period, todayKey: input.todayKey, programs }
  );
  const { changed } = await saveRolScan(result);
  return { fsChecked: result.fsChecked, programs: result.drafts.length, changed };
}
