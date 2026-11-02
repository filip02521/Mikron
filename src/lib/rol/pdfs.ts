// @service-role-ok — wywoływane z akcji po requireOperations() + rola admin/zakupy, z trasy pobrania plików i z crona.
/**
 * PDF-y FS do zgłoszeń ROL (plasterek 4). Subiekt drukuje FS ok. 45 s, więc pobieramy je w tle
 * (po skanie, na żądanie, w cronie) i trzymamy w `rol_fs_pdfs` do wysyłki. Każdą FS najpierw
 * „rezerwujemy” w bazie — dwa przebiegi naraz nie drukują tej samej faktury.
 */
import { mapPool } from "@/lib/async/map-pool";
import { query } from "@/lib/db/pool";
import { getSubiektOrdersFsPdf } from "@/lib/subiekt/api";

/** Próba starsza niż to uznajemy za przerwaną (timeout wydruku to 90 s × do 3 prób). */
export const ROL_PDF_CLAIM_MS = 6 * 60_000;
export const ROL_PDF_MAX_ATTEMPTS = 5;

export type RolPdfState = "gotowy" | "pobieram" | "czeka" | "blad";

export type RolPdfRow = {
  hasPdf: boolean;
  attempts: number;
  lastError: string;
  lastAttemptAt: string | null;
};

/** Stan PDF jednej FS do pokazania przy fakturze. Brak wiersza = jeszcze nie próbowano. */
export function rolPdfState(row: RolPdfRow | undefined, nowMs: number): RolPdfState {
  if (!row) return "czeka";
  if (row.hasPdf) return "gotowy";
  if (row.lastError) return "blad";
  const inFlight = row.lastAttemptAt !== null && nowMs - Date.parse(row.lastAttemptAt) < ROL_PDF_CLAIM_MS;
  return inFlight ? "pobieram" : "czeka";
}

/** FS włączone do niewysłanych paczek, które nie mają jeszcze PDF. */
async function missingFsIds(): Promise<number[]> {
  const res = await query<{ fs_dok_id: number }>(
    `SELECT DISTINCT i.fs_dok_id
       FROM rol_batch_invoices i
       JOIN rol_batches b ON b.id = i.batch_id
       LEFT JOIN rol_fs_pdfs p ON p.fs_dok_id = i.fs_dok_id
      WHERE NOT i.excluded AND b.status IN ('wykryte', 'przejrzane') AND p.pdf IS NULL
      ORDER BY 1`
  );
  return res.rows.map((r) => Number(r.fs_dok_id));
}

/** Ile FS z niewysłanych paczek czeka na PDF (i nie wyczerpało prób) — krok crona pobiera je w każdym slocie. */
export async function countMissingRolPdfs(): Promise<number> {
  const ids = await missingFsIds();
  if (!ids.length) return 0;
  const res = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM rol_fs_pdfs WHERE fs_dok_id = ANY($1::int[]) AND attempts >= $2`,
    [ids, ROL_PDF_MAX_ATTEMPTS]
  );
  return ids.length - Number(res.rows[0]?.n ?? 0);
}

/** Rezerwacja FS do druku; false = ktoś już ją drukuje, jest gotowa albo wyczerpała próby. */
async function claim(fsDokId: number): Promise<boolean> {
  const res = await query(
    `INSERT INTO rol_fs_pdfs (fs_dok_id, attempts, last_attempt_at, last_error)
     VALUES ($1, 1, now(), '')
     ON CONFLICT (fs_dok_id) DO UPDATE
        SET attempts = rol_fs_pdfs.attempts + 1, last_attempt_at = now(), last_error = ''
      WHERE rol_fs_pdfs.pdf IS NULL
        AND rol_fs_pdfs.attempts < $2
        AND (rol_fs_pdfs.last_attempt_at IS NULL OR rol_fs_pdfs.last_attempt_at < now() - make_interval(secs => $3))
     RETURNING fs_dok_id`,
    [fsDokId, ROL_PDF_MAX_ATTEMPTS, ROL_PDF_CLAIM_MS / 1000]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Pobiera brakujące PDF-y w ramach budżetu czasu. Nowej FS nie zaczyna po przekroczeniu budżetu
 * (rozpoczęty wydruk kończy się normalnie). Zwraca liczbę pobranych i nieudanych.
 */
export async function fetchMissingRolPdfs(input: {
  budgetMs: number;
  concurrency?: number;
  print?: (fsDokId: number) => Promise<Buffer>;
}): Promise<{ fetched: number; failed: number; skipped: number }> {
  const started = Date.now();
  const print = input.print ?? getSubiektOrdersFsPdf;
  let fetched = 0;
  let failed = 0;
  let skipped = 0;
  // Jedna FS naraz: Subiekt drukuje po kolei, druga równoległa prośba czeka w kolejce i przekracza
  // 90 s limitu (pomiar 29.10.2026: przy 2 naraz 1 z 3 wydruków kończyła się timeoutem).
  await mapPool(await missingFsIds(), input.concurrency ?? 1, async (fsDokId) => {
    if (Date.now() - started > input.budgetMs || !(await claim(fsDokId))) {
      skipped += 1;
      return;
    }
    try {
      const pdf = await print(fsDokId);
      await query(`UPDATE rol_fs_pdfs SET pdf = $2, fetched_at = now(), last_error = '' WHERE fs_dok_id = $1`, [fsDokId, pdf]);
      fetched += 1;
    } catch (e) {
      const msg = (e instanceof Error ? e.message : String(e)).slice(0, 300) || "Nieznany błąd wydruku";
      await query(`UPDATE rol_fs_pdfs SET last_error = $2 WHERE fs_dok_id = $1`, [fsDokId, msg]);
      failed += 1;
    }
  });
  return { fetched, failed, skipped };
}

/** „Pobierz ponownie”: zeruje licznik prób FS bez PDF w niewysłanych paczkach. */
export async function resetFailedRolPdfs(): Promise<void> {
  await query(
    `UPDATE rol_fs_pdfs SET attempts = 0, last_error = '', last_attempt_at = NULL
      WHERE pdf IS NULL AND fs_dok_id IN (
        SELECT i.fs_dok_id FROM rol_batch_invoices i JOIN rol_batches b ON b.id = i.batch_id
         WHERE NOT i.excluded AND b.status IN ('wykryte', 'przejrzane'))`
  );
}

export async function loadRolPdfRows(fsDokIds: readonly number[]): Promise<Map<number, RolPdfRow>> {
  if (!fsDokIds.length) return new Map();
  const res = await query<{ fs_dok_id: number; has_pdf: boolean; attempts: number; last_error: string; last_attempt_at: string | null }>(
    `SELECT fs_dok_id, pdf IS NOT NULL AS has_pdf, attempts, last_error, last_attempt_at::text
       FROM rol_fs_pdfs WHERE fs_dok_id = ANY($1::int[])`,
    [[...fsDokIds]]
  );
  return new Map(
    res.rows.map((r) => [
      Number(r.fs_dok_id),
      { hasPdf: r.has_pdf, attempts: r.attempts, lastError: r.last_error, lastAttemptAt: r.last_attempt_at },
    ])
  );
}

export async function loadRolPdfBytes(fsDokIds: readonly number[]): Promise<Map<number, Buffer>> {
  if (!fsDokIds.length) return new Map();
  const res = await query<{ fs_dok_id: number; pdf: Buffer }>(
    `SELECT fs_dok_id, pdf FROM rol_fs_pdfs WHERE fs_dok_id = ANY($1::int[]) AND pdf IS NOT NULL`,
    [[...fsDokIds]]
  );
  return new Map(res.rows.map((r) => [Number(r.fs_dok_id), r.pdf]));
}
