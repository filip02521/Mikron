// @service-role-ok — krok nocnego crona (autoryzacja trasy crona), zapis tylko tabel rol_*.
/**
 * Zgłoszenia ROL jako krok w istniejącym cronie `catalog-zd-sync` (02:00–04:40), bez osobnego zadania
 * Windows (`install-cron.ps1` nie jest uruchamiany przy wdrożeniu). Co noc, gdy jest coś do zrobienia
 * dla zgłaszanych okresów (poprzedni miesiąc, miniony tydzień / dwa tygodnie): pierwszy skan albo ponowny,
 * dopóki paczka nie jest wysłana (dochodzą FS z datą wsteczną i KFS). Potem PDF-y FS w tle w ramach budżetu.
 */
import { query } from "@/lib/db/pool";
import { recordCronRun } from "@/lib/services/cron-run-log";
import { isSubiektReachable } from "@/lib/subiekt/availability";
import { recordCronSkipped, warsawCronContext } from "@/lib/time/warsaw-cron";
import { warsawNowParts } from "@/lib/time/warsaw";
import { loadRolPrograms, runRolScan } from "./data";
import type { RolBatchStatus } from "./merge";
import { countMissingRolPdfs, fetchMissingRolPdfs } from "./pdfs";
import {
  lastShortRange,
  previousMonthPeriod,
  programsForRange,
  rolMonthRange,
  type RolProgramScope,
  type RolRange,
} from "./scan";

/** Paczki, które jeszcze mogą się zmienić po skanie — ponowny skan co noc. */
const RESCAN_STATUSES: readonly RolBatchStatus[] = ["wykryte", "przejrzane", "brak_zakupow"];

type CronProgram = Pick<RolProgramScope, "id" | "active" | "reportFrequency">;

/**
 * Raporty, których pilnuje dziś cron: ostatni zakończony tydzień / dwa tygodnie (gdy ktoś ma taką
 * częstotliwość) i poprzedni miesiąc. Krótsze pierwsze — FS trafia do najwcześniejszego raportu,
 * a miesięczny zbiera tylko to, czego nie było w krótszych.
 */
export function rolCronRanges(todayKey: string, programs: readonly CronProgram[]): RolRange[] {
  const short = (["week", "2weeks"] as const)
    .filter((f) => programs.some((p) => p.active && p.reportFrequency === f))
    .map((f) => lastShortRange(f, todayKey));
  return [...short, rolMonthRange(previousMonthPeriod(todayKey))];
}

/**
 * Do zrobienia: któryś klient, którego dotyczy raport za `range`, nie ma paczki albo jego paczka nie jest
 * jeszcze wysłana i nie była skanowana dziś (cron ma kilka slotów w nocy — skan raz na dzień).
 * Gdy wszystkie są wysłane — nic do roboty aż do następnego okresu.
 */
export function rolScanDue(input: {
  range: RolRange;
  todayKey: string;
  programs: readonly CronProgram[];
  batches: ReadonlyArray<{ programId: string; status: RolBatchStatus; scannedDateKey: string }>;
}): boolean {
  const byProgram = new Map(input.batches.map((b) => [b.programId, b]));
  return programsForRange(input.programs, input.range).some((p) => {
    const b = byProgram.get(p.id);
    return !b || (RESCAN_STATUSES.includes(b.status) && b.scannedDateKey < input.todayKey);
  });
}

/** Krok ROL w cronie: skany, gdy należą, i brakujące PDF-y FS. Nigdy nie rzuca — wynik w monitorze cronów. */
export async function runRolCronStep(input: { budgetMs: number }): Promise<void> {
  const started = Date.now();
  const todayKey = warsawNowParts().dateKey;
  let ranges: RolRange[] = [];
  try {
    const programs = await loadRolPrograms();
    ranges = rolCronRanges(todayKey, programs);
    const due: RolRange[] = [];
    for (const range of ranges) {
      const batches = await query<{ program_id: string; status: RolBatchStatus; scanned: string }>(
        `SELECT program_id, status, to_char(scanned_at AT TIME ZONE 'Europe/Warsaw', 'YYYY-MM-DD') AS scanned
           FROM rol_batches WHERE period = $1::date AND period_end = $2::date`,
        [range.start, range.end]
      );
      const batchRows = batches.rows.map((b) => ({ programId: b.program_id, status: b.status, scannedDateKey: b.scanned }));
      if (rolScanDue({ range, todayKey, programs, batches: batchRows })) due.push(range);
    }
    const pdfsMissing = await countMissingRolPdfs();
    if (!due.length && !pdfsMissing) {
      await recordCronSkipped("rol_reports", "not_due", { ranges });
      return;
    }
    if (!(await isSubiektReachable({ force: true }))) {
      await recordCronRun("rol_reports", { ok: false, detail: { ranges, subiektOffline: true, ...warsawCronContext() }, error: "subiekt_offline" });
      return;
    }
    // Skan raz na dzień; brakujące PDF-y w każdym slocie nocy (zerwany wydruk ponawiamy jeszcze tej nocy).
    const scans = [];
    for (const range of due) scans.push({ range, ...(await runRolScan({ range, todayKey })) });
    const pdfs = await fetchMissingRolPdfs({ budgetMs: Math.max(0, input.budgetMs - (Date.now() - started)) });
    await recordCronRun("rol_reports", {
      ok: pdfs.failed === 0,
      detail: { ranges, scans, ...pdfs, ...warsawCronContext() },
      error: pdfs.failed ? "pdf_failed" : undefined,
    });
  } catch (e) {
    await recordCronRun("rol_reports", { ok: false, detail: { ranges }, error: e instanceof Error ? e.message : String(e) });
  }
}
