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
import { loadRolPdfRows, rolPdfState, type RolPdfState } from "./pdfs";
import { loadRolLastSends } from "./send-io";
import { decideRolMerge, type RolBatchStatus } from "./merge";
import { rolApproveError, rolAssignedElsewhereReason, rolInvoiceAfterRescan, rolReopenError } from "./review";
import type { RolProgramValues } from "./program";
import { ROL_ASSIGNED_HERE_REASON } from "./constants";
import { ROL_NEEDS_ACTION_STATUSES } from "./view";
import { previousMonthPeriod, ROL_CONFLICT_REASON, scanRolPeriod, type RolBatchDraft, type RolScanResult } from "./scan";

export type RolProgram = RolProgramValues & { id: string; sendMode: "review" | "auto" };

export type RolInvoiceView = {
  fsDokId: number;
  fsNr: string;
  fsDate: string | null;
  otherLinesCount: number;
  kfsDokIds: number[];
  excluded: boolean;
  excludedReason: string;
  /** Wydruk FS do PDF (pobierany w tle po skanie). */
  pdf: RolPdfState;
  pdfError: string;
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
  zdDokId: number | null;
  zdNr: string | null;
  /** Ostatni wysłany mail tej paczki. */
  lastSend: { sentAt: string; from: string } | null;
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
    zd_dok_id: number | null;
    zd_nr: string | null;
  }>(
    `SELECT id, program_id, to_char(period, 'YYYY-MM-DD') AS period, status, scanned_at::text, fs_checked_count,
            change_note, late_fs_count, reviewed_at::text, zd_dok_id, zd_nr
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
  const [pdfRows, lastSends] = await Promise.all([
    loadRolPdfRows([...new Set(invoices.rows.map((i) => Number(i.fs_dok_id)))]),
    loadRolLastSends(ids),
  ]);
  const now = Date.now();
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
    zdDokId: b.zd_dok_id,
    zdNr: b.zd_nr,
    lastSend: lastSends.get(b.id) ?? null,
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
        pdf: rolPdfState(pdfRows.get(Number(i.fs_dok_id)), now),
        pdfError: pdfRows.get(Number(i.fs_dok_id))?.lastError ?? "",
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

/** Licznik w menu: paczki bieżącego zgłoszenia (poprzedni miesiąc), które czekają na przegląd albo wysyłkę. */
export async function countRolNeedsAction(todayKey: string): Promise<number> {
  const res = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM rol_batches WHERE period = $1::date AND status = ANY($2::text[])`,
    [previousMonthPeriod(todayKey), [...ROL_NEEDS_ACTION_STATUSES]]
  );
  return Number(res.rows[0]?.n ?? 0);
}

/** Paczka po id (z FS, pozycjami i stanem PDF) oraz jej klient. */
export async function loadRolBatchById(batchId: string): Promise<{ batch: RolBatchView; program: RolProgram } | null> {
  const res = await query<{ period: string; program_id: string }>(
    `SELECT to_char(period, 'YYYY-MM-DD') AS period, program_id FROM rol_batches WHERE id = $1`,
    [batchId]
  );
  const row = res.rows[0];
  if (!row) return null;
  const [batches, programs] = await Promise.all([loadRolBatches(row.period), loadRolPrograms()]);
  const batch = batches.find((b) => b.id === batchId);
  const program = programs.find((p) => p.id === row.program_id);
  return batch && program ? { batch, program } : null;
}

/**
 * Podmiana FS i pozycji paczki z zachowaniem decyzji użytkownika (wyłączenia, ręczne ilości)
 * dla FS i towarów, które zostały. Wyłączenie „do decyzji” liczy skan na nowo.
 */
async function replaceBatchContent(db: PoolClient, batchId: string, draft: RolBatchDraft): Promise<void> {
  const prevInvoices = await db.query<{ fs_dok_id: number; excluded: boolean; excluded_reason: string }>(
    `SELECT fs_dok_id, excluded, excluded_reason FROM rol_batch_invoices WHERE batch_id = $1`,
    [batchId]
  );
  const prevByFs = new Map(
    prevInvoices.rows.map((r) => [r.fs_dok_id, { excluded: r.excluded, excludedReason: r.excluded_reason }])
  );
  const keptLines = await db.query<{
    fs_dok_id: number;
    subiekt_tw_id: number;
    qty_override: string | null;
    excluded: boolean;
    note: string;
    ivoclar_catalog_no: string | null;
  }>(
    `SELECT fs_dok_id, subiekt_tw_id, qty_override::text, excluded, note, ivoclar_catalog_no FROM rol_batch_lines
      WHERE batch_id = $1 AND (excluded OR qty_override IS NOT NULL OR note <> '' OR ivoclar_catalog_no IS NOT NULL)`,
    [batchId]
  );
  const lineKey = (fs: number, tw: number) => `${fs}:${tw}`;
  const userLines = new Map(keptLines.rows.map((r) => [lineKey(r.fs_dok_id, r.subiekt_tw_id), r]));

  await db.query(`DELETE FROM rol_batch_lines WHERE batch_id = $1`, [batchId]);
  await db.query(`DELETE FROM rol_batch_invoices WHERE batch_id = $1`, [batchId]);
  for (const inv of draft.invoices) {
    const decided = rolInvoiceAfterRescan(prevByFs.get(inv.fsDokId), inv);
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
        decided.excluded,
        decided.excludedReason,
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
        // Numer wpisany ręcznie zostaje, dopóki symbol w Subiekcie nie da własnego.
        l.ivoclarCatalogNo ?? user?.ivoclar_catalog_no ?? null,
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

// --- Przegląd (plasterek 3): zmiany tylko w stanie „wykryte”, pod blokadą wiersza paczki. ---

type LockedBatch = { id: string; program_id: string; period: string; status: RolBatchStatus };

async function inTransaction<T>(fn: (db: PoolClient) => Promise<T>): Promise<T> {
  return withClient(async (db) => {
    await db.query("BEGIN");
    try {
      const out = await fn(db);
      await db.query("COMMIT");
      return out;
    } catch (e) {
      await db.query("ROLLBACK");
      throw e;
    }
  });
}

async function lockBatch(db: PoolClient, batchId: string): Promise<LockedBatch> {
  const res = await db.query<LockedBatch>(
    `SELECT id, program_id, to_char(period, 'YYYY-MM-DD') AS period, status FROM rol_batches WHERE id = $1 FOR UPDATE`,
    [batchId]
  );
  const row = res.rows[0];
  if (!row) throw new Error("Nie znaleziono zgłoszenia — odśwież stronę.");
  return row;
}

async function lockEditableBatch(db: PoolClient, batchId: string): Promise<LockedBatch> {
  const row = await lockBatch(db, batchId);
  if (row.status !== "wykryte") {
    throw new Error(
      row.status === "przejrzane"
        ? "Lista jest zatwierdzona — kliknij „Edytuj listę”, żeby ją zmienić."
        : "Tego zgłoszenia nie można już zmieniać."
    );
  }
  return row;
}

/** Wyłącz / włącz FS albo przypisz FS z konfliktem do tego klienta (u drugiego klienta zostaje wyłączona). */
export async function setRolInvoice(input: {
  batchId: string;
  fsDokId: number;
  mode: "exclude" | "include" | "assign";
  reason?: string;
}): Promise<void> {
  await inTransaction(async (db) => {
    const batch = await lockEditableBatch(db, input.batchId);
    const cur = await db.query<{ excluded: boolean; excluded_reason: string }>(
      `SELECT excluded, excluded_reason FROM rol_batch_invoices WHERE batch_id = $1 AND fs_dok_id = $2`,
      [batch.id, input.fsDokId]
    );
    const inv = cur.rows[0];
    if (!inv) throw new Error("Tej FS nie ma już w zgłoszeniu — odśwież stronę.");
    const contested = inv.excluded_reason === ROL_CONFLICT_REASON || inv.excluded_reason.startsWith("Przypisana do ROL ");

    if (input.mode === "exclude") {
      const reason = (input.reason ?? "").trim().slice(0, 200) || "Wyłączona ręcznie";
      await db.query(`UPDATE rol_batch_invoices SET excluded = true, excluded_reason = $3 WHERE batch_id = $1 AND fs_dok_id = $2`, [
        batch.id,
        input.fsDokId,
        reason,
      ]);
      return;
    }
    if (input.mode === "include" && contested) {
      throw new Error("Ta FS pasuje też do innego klienta ROL — użyj „Przypisz do tego klienta”.");
    }
    if (input.mode === "assign" && !contested) throw new Error("Ta FS nie wymaga przypisania.");

    await db.query(`UPDATE rol_batch_invoices SET excluded = false, excluded_reason = $3 WHERE batch_id = $1 AND fs_dok_id = $2`, [
      batch.id,
      input.fsDokId,
      input.mode === "assign" ? ROL_ASSIGNED_HERE_REASON : "",
    ]);
    if (input.mode === "assign") {
      const label = await db.query<{ label: string }>(`SELECT label FROM rol_programs WHERE id = $1`, [batch.program_id]);
      const others = await db.query<{ id: string; status: RolBatchStatus }>(
        `SELECT b.id, b.status FROM rol_batches b JOIN rol_batch_invoices i ON i.batch_id = b.id
          WHERE b.period = $1::date AND b.id <> $2 AND i.fs_dok_id = $3 FOR UPDATE OF b`,
        [batch.period, batch.id, input.fsDokId]
      );
      if (others.rows.some((o) => o.status !== "wykryte")) {
        throw new Error("Drugi klient ma już zatwierdzoną listę z tą FS — najpierw kliknij u niego „Edytuj listę”.");
      }
      await db.query(
        `UPDATE rol_batch_invoices SET excluded = true, excluded_reason = $3 WHERE batch_id = ANY($1::uuid[]) AND fs_dok_id = $2`,
        [others.rows.map((o) => o.id), input.fsDokId, rolAssignedElsewhereReason(label.rows[0]?.label ?? "")]
      );
    }
  });
}

/** Zmiana pozycji: wyłączenie, ilość ręczna (null = z FS), numer katalogowy Ivoclar. */
export async function setRolLine(input: {
  batchId: string;
  lineId: number;
  excluded?: boolean;
  qtyOverride?: number | null;
  catalogNo?: string;
}): Promise<void> {
  await inTransaction(async (db) => {
    const batch = await lockEditableBatch(db, input.batchId);
    const res = await db.query(
      `UPDATE rol_batch_lines SET
          excluded = CASE WHEN $3::boolean IS NULL THEN excluded ELSE $3 END,
          qty_override = CASE WHEN $4 THEN $5::numeric ELSE qty_override END,
          ivoclar_catalog_no = COALESCE($6, ivoclar_catalog_no)
        WHERE batch_id = $1 AND id = $2`,
      [
        batch.id,
        input.lineId,
        input.excluded ?? null,
        input.qtyOverride !== undefined,
        input.qtyOverride ?? null,
        input.catalogNo ?? null,
      ]
    );
    if (!res.rowCount) throw new Error("Tej pozycji nie ma już w zgłoszeniu — odśwież stronę.");
  });
}

/** „Zatwierdź listę”: sprawdza blokady na świeżym odczycie pod blokadą wiersza. */
export async function approveRolBatch(batchId: string, userId: string): Promise<void> {
  await inTransaction(async (db) => {
    const batch = await lockBatch(db, batchId);
    const [invoices, lines] = await Promise.all([
      db.query<{ fs_dok_id: number; excluded: boolean; excluded_reason: string }>(
        `SELECT fs_dok_id, excluded, excluded_reason FROM rol_batch_invoices WHERE batch_id = $1`,
        [batchId]
      ),
      db.query<{ id: string; fs_dok_id: number; subiekt_tw_id: number; ivoclar_catalog_no: string | null; qty_fs: string; qty_kfs: string; qty_override: string | null; excluded: boolean }>(
        `SELECT id::text, fs_dok_id, subiekt_tw_id, ivoclar_catalog_no, qty_fs::text, qty_kfs::text, qty_override::text, excluded
           FROM rol_batch_lines WHERE batch_id = $1`,
        [batchId]
      ),
    ]);
    const error = rolApproveError({
      status: batch.status,
      invoices: invoices.rows.map((i) => ({
        fsDokId: i.fs_dok_id,
        fsNr: "",
        fsDate: null,
        otherLinesCount: 0,
        kfsDokIds: [],
        excluded: i.excluded,
        excludedReason: i.excluded_reason,
        pdf: "czeka" as const,
        pdfError: "",
      })),
      lines: lines.rows.map((l) => ({
        id: Number(l.id),
        fsDokId: l.fs_dok_id,
        twId: l.subiekt_tw_id,
        symbol: "",
        ivoclarCatalogNo: l.ivoclar_catalog_no,
        name: "",
        qtyFs: Number(l.qty_fs),
        qtyKfs: Number(l.qty_kfs),
        qtyOverride: l.qty_override === null ? null : Number(l.qty_override),
        excluded: l.excluded,
      })),
    });
    if (error) throw new Error(error);
    await db.query(
      `UPDATE rol_batches SET status = 'przejrzane', reviewed_by = $2, reviewed_at = now(), change_note = '' WHERE id = $1`,
      [batchId, userId]
    );
  });
}

/** „Edytuj listę”: z „przejrzane” z powrotem do „wykryte”. */
export async function reopenRolBatch(batchId: string): Promise<void> {
  await inTransaction(async (db) => {
    const batch = await lockBatch(db, batchId);
    const error = rolReopenError(batch.status);
    if (error) throw new Error(error);
    await db.query(`UPDATE rol_batches SET status = 'wykryte', reviewed_by = NULL, reviewed_at = NULL WHERE id = $1`, [batchId]);
  });
}
