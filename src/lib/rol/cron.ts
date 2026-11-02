// @service-role-ok — krok nocnego crona (autoryzacja trasy crona), zapis tylko tabel rol_*.
/**
 * Zgłoszenia ROL jako krok w istniejącym cronie `catalog-zd-sync` (02:00–04:40), bez osobnego zadania
 * Windows (`install-cron.ps1` nie jest uruchamiany przy wdrożeniu). Co noc, gdy jest coś do zrobienia
 * dla zgłaszanego miesiąca (poprzedniego): pierwszy skan albo ponowny, dopóki paczka nie jest wysłana
 * (dochodzą FS z datą wsteczną i KFS). Potem PDF-y FS w tle w ramach budżetu.
 */
import { query } from "@/lib/db/pool";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";
import { warsawNowParts } from "@/lib/time/warsaw";
import { loadRolPrograms, runRolScan } from "./data";
import type { RolBatchStatus } from "./merge";
import { countMissingRolPdfs, fetchMissingRolPdfs } from "./pdfs";
import { previousMonthPeriod, programActiveInPeriod, type RolProgramScope } from "./scan";

/** Paczki, które jeszcze mogą się zmienić po skanie — ponowny skan co noc. */
const RESCAN_STATUSES: readonly RolBatchStatus[] = ["wykryte", "przejrzane", "brak_zakupow"];

/**
 * Do zrobienia: któryś klient ROL aktywny w zgłaszanym miesiącu nie ma paczki albo jego paczka nie jest
 * jeszcze wysłana i nie była skanowana dziś (cron ma kilka slotów w nocy — skan raz na dzień).
 * Gdy wszystkie są wysłane — nic do roboty aż do następnego miesiąca.
 */
export function rolScanDue(input: {
  period: string;
  todayKey: string;
  programs: ReadonlyArray<Pick<RolProgramScope, "id" | "activeFrom" | "activeTo">>;
  batches: ReadonlyArray<{ programId: string; status: RolBatchStatus; scannedDateKey: string }>;
}): boolean {
  const byProgram = new Map(input.batches.map((b) => [b.programId, b]));
  return input.programs
    .filter((p) => programActiveInPeriod(p, input.period))
    .some((p) => {
      const b = byProgram.get(p.id);
      return !b || (RESCAN_STATUSES.includes(b.status) && b.scannedDateKey < input.todayKey);
    });
}

/** Krok ROL w cronie: skan, gdy należy, i brakujące PDF-y FS. Nigdy nie rzuca — wynik w monitorze cronów. */
export async function runRolCronStep(input: { budgetMs: number }): Promise<void> {
  const started = Date.now();
  const todayKey = warsawNowParts().dateKey;
  const period = previousMonthPeriod(todayKey);
  try {
    const programs = await loadRolPrograms();
    const batches = await query<{ program_id: string; status: RolBatchStatus; scanned: string }>(
      `SELECT program_id, status, to_char(scanned_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS scanned
         FROM rol_batches WHERE period = $1::date`,
      [period]
    );
    const due = rolScanDue({
      period,
      todayKey,
      programs,
      batches: batches.rows.map((b) => ({ programId: b.program_id, status: b.status, scannedDateKey: b.scanned })),
    });
    const pdfsMissing = await countMissingRolPdfs();
    if (!due && !pdfsMissing) {
      await recordCronSkipped("rol_reports", "not_due", { period });
      return;
    }
    if (!(await isSubiektReachable({ force: true }))) {
      await recordCronRun("rol_reports", { ok: false, detail: { period, subiektOffline: true, ...warsawCronContext() }, error: "subiekt_offline" });
      return;
    }
    // Skan raz na dzień; brakujące PDF-y w każdym slocie nocy (zerwany wydruk ponawiamy jeszcze tej nocy).
    const scan = due ? await runRolScan({ period, todayKey }) : null;
    const pdfs = await fetchMissingRolPdfs({ budgetMs: Math.max(0, input.budgetMs - (Date.now() - started)) });
    await recordCronRun("rol_reports", {
      ok: pdfs.failed === 0,
      detail: {
        period,
        ...(scan ? { fsChecked: scan.fsChecked, programs: scan.programs, changed: scan.changed } : { scanned: false }),
        ...pdfs,
        ...warsawCronContext(),
      },
      error: pdfs.failed ? "pdf_failed" : undefined,
    });
  } catch (e) {
    await recordCronRun("rol_reports", { ok: false, detail: { period }, error: e instanceof Error ? e.message : String(e) });
  }
}
