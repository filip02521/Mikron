/**
 * Synchronizacja ZD/FZ z Subiekta → próbki czasów dostaw (source = 'subiekt').
 *
 * - pełna: cała historia od 2006 (jednorazowo / po zmianach w regułach),
 * - przyrostowa (noc): ostatnie 18 mies. — domyka łańcuchy braków i statusy ZD,
 * - zawsze po pobraniu: pełne przeliczenie próbek z kopii (sekundy, bez Subiekta).
 */
import type { PoolClient } from "pg";
import { query, withClient } from "@/lib/db/pool";
import { createAdminClient } from "@/lib/supabase/admin";
import { searchSubiektOrdersDocuments } from "@/lib/subiekt/api";
import type { SubiektDocument } from "@/lib/subiekt/types";
import { releaseLock, tryAcquireLock } from "@/lib/services/locks";
import { fetchDeliveryStatsFromSamplesEnabled } from "@/lib/data/delivery-stats-flags";
import { recomputeAllDeliveryStatsFromSamples } from "@/lib/data/delivery-stats-samples";
import {
  analyzeSubiektLeadTimes,
  SUBIEKT_DOC_TYPE_FZ,
  SUBIEKT_DOC_TYPE_ZD,
  type SubiektLeadTimeAnalysis,
} from "@/lib/orders/subiekt-lead-times";
import { warsawNowParts } from "@/lib/time/warsaw";

export const SUBIEKT_LEAD_TIMES_STATE_KEY = "subiekt_lead_times_state";
const LOCK_KEY = "job_subiekt_lead_times_lock";
const FULL_HISTORY_FROM_YEAR = 2006;
const INCREMENTAL_MONTHS = 18;
const PAGE_SIZE = 200;
const DB_CHUNK = 1000;

export type SubiektLeadTimesSyncMode = "full" | "incremental";

export type SubiektLeadTimesSyncState = {
  at: string;
  mode: SubiektLeadTimesSyncMode;
  ok: boolean;
  durationMs: number;
  docsFetched: number;
  docsStored: number;
  samples: number;
  samplesAssigned: number;
  statsRecomputed: number | null;
  counts: SubiektLeadTimeAnalysis["counts"] | null;
  suppliers: { assigned: number; shared: number; osobno: number; unmappedKh: number } | null;
  error?: string;
};

type DocRow = {
  dok_id: number;
  typ: number;
  nr_pelny: string | null;
  nr_oryg: string | null;
  kh_id: number | null;
  kh_symbol: string | null;
  data_wyst: string | null;
  data_mag: string | null;
  status: number | null;
  do_dok_id: number | null;
  uwagi: string | null;
  wart_netto: number | null;
};

const dateKey = (v: unknown): string | null =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null;
const intOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : null;
const textOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, 500) : null;

function toDocRow(d: SubiektDocument, typ: number): DocRow {
  return {
    dok_id: d.dok_Id,
    typ,
    nr_pelny: textOrNull(d.dok_NrPelny),
    nr_oryg: textOrNull(d.dok_NrPelnyOryg),
    kh_id: intOrNull(d.dok_OdbiorcaId),
    kh_symbol: textOrNull(d.kh__Kontrahent_Odbiorca?.kh_Symbol),
    data_wyst: dateKey(d.dok_DataWyst),
    data_mag: dateKey(d.dok_DataMag),
    status: intOrNull(d.dok_Status),
    do_dok_id: intOrNull(d.dok_DoDokId),
    uwagi: textOrNull(d.dok_Uwagi),
    wart_netto: typeof d.dok_WartNetto === "number" ? d.dok_WartNetto : null,
  };
}

/**
 * Całe okno, bez duplikatów (dokument dopisany w trakcie stronicowania przesuwa strony).
 * `complete` = pobrano tyle, ile API deklaruje — tylko wtedy wolno usuwać z kopii brakujące.
 */
async function fetchDocsWindow(
  typ: number,
  dataOd: string,
  dataDo: string
): Promise<{ rows: DocRow[]; complete: boolean }> {
  const byId = new Map<number, DocRow>();
  let seen = 0;
  let page = 1;
  let totalPages = 1;
  let totalCount: number | null = null;
  do {
    const res = await searchSubiektOrdersDocuments({ typ, dataOd, dataDo, page, pageSize: PAGE_SIZE });
    for (const d of res.data ?? []) {
      seen++;
      // Filtr `typ` w API — pilnujemy też po stronie aplikacji.
      if (d.dok_Typ != null && d.dok_Typ !== typ) continue;
      byId.set(d.dok_Id, toDocRow(d, typ));
    }
    totalPages = Math.max(1, res.pagination?.totalPages ?? 1);
    totalCount = res.pagination?.totalCount ?? totalCount;
    page++;
  } while (page <= totalPages);
  return { rows: [...byId.values()], complete: totalCount != null && seen === totalCount && seen === byId.size };
}

async function upsertDocs(client: PoolClient, rows: DocRow[]): Promise<void> {
  for (let i = 0; i < rows.length; i += DB_CHUNK) {
    const chunk = rows.slice(i, i + DB_CHUNK);
    const col = <K extends keyof DocRow>(k: K) => chunk.map((r) => r[k]);
    await client.query(
      `INSERT INTO subiekt_purchase_docs
         (dok_id, typ, nr_pelny, nr_oryg, kh_id, kh_symbol, data_wyst, data_mag, status, do_dok_id, uwagi, wart_netto, synced_at)
       SELECT *, now() FROM unnest(
         $1::int[], $2::smallint[], $3::text[], $4::text[], $5::int[], $6::text[],
         $7::date[], $8::date[], $9::smallint[], $10::int[], $11::text[], $12::numeric[])
       ON CONFLICT (dok_id) DO UPDATE SET
         typ = EXCLUDED.typ, nr_pelny = EXCLUDED.nr_pelny, nr_oryg = EXCLUDED.nr_oryg,
         kh_id = EXCLUDED.kh_id, kh_symbol = EXCLUDED.kh_symbol, data_wyst = EXCLUDED.data_wyst,
         data_mag = EXCLUDED.data_mag, status = EXCLUDED.status, do_dok_id = EXCLUDED.do_dok_id,
         uwagi = EXCLUDED.uwagi, wart_netto = EXCLUDED.wart_netto, synced_at = now()`,
      [
        col("dok_id"), col("typ"), col("nr_pelny"), col("nr_oryg"), col("kh_id"), col("kh_symbol"),
        col("data_wyst"), col("data_mag"), col("status"), col("do_dok_id"), col("uwagi"), col("wart_netto"),
      ]
    );
  }
}

/** Okno pobrane w całości → dokumenty usunięte w Subiekcie znikają też z kopii. */
async function syncWindow(typ: number, dataOd: string, dataDo: string): Promise<number> {
  const { rows, complete } = await fetchDocsWindow(typ, dataOd, dataDo);
  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      await upsertDocs(client, rows);
      if (complete) await client.query(
        `DELETE FROM subiekt_purchase_docs
         WHERE typ = $1 AND data_wyst BETWEEN $2::date AND $3::date AND NOT (dok_id = ANY($4::int[]))`,
        [typ, dataOd, dataDo, rows.map((r) => r.dok_id)]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });
  return rows.length;
}

function syncWindows(mode: SubiektLeadTimesSyncMode): Array<[string, string]> {
  const today = warsawNowParts().dateKey;
  if (mode === "incremental") {
    const from = new Date(`${today}T12:00:00Z`);
    from.setUTCMonth(from.getUTCMonth() - INCREMENTAL_MONTHS);
    return [[from.toISOString().slice(0, 10), today]];
  }
  const windows: Array<[string, string]> = [];
  const lastYear = Number(today.slice(0, 4));
  for (let y = FULL_HISTORY_FROM_YEAR; y <= lastYear; y++) windows.push([`${y}-01-01`, `${y}-12-31`]);
  return windows;
}

/** kh_Id → dostawca: tylko jednoznaczne (jedna karta) i nie „osobno” (Główne/Uzupełniające liczone oddzielnie). */
async function loadKhAssignment() {
  const supabase = createAdminClient();
  const [suppliersRes, aliasesRes] = await Promise.all([
    supabase.from("suppliers").select("id, subiekt_kh_id, stats_mode"),
    supabase.from("supplier_subiekt_kh_aliases").select("supplier_id, subiekt_kh_id"),
  ]);
  if (suppliersRes.error) throw new Error(suppliersRes.error.message);
  const statsMode = new Map<string, string>();
  const khToSuppliers = new Map<number, Set<string>>();
  const add = (kh: number | null | undefined, supplierId: string) => {
    if (kh == null || kh <= 0) return;
    const set = khToSuppliers.get(kh) ?? new Set<string>();
    set.add(supplierId);
    khToSuppliers.set(kh, set);
  };
  for (const s of suppliersRes.data ?? []) {
    statsMode.set(s.id, s.stats_mode);
    add(s.subiekt_kh_id, s.id);
  }
  for (const a of aliasesRes.data ?? []) add(a.subiekt_kh_id, a.supplier_id);

  return (kh: number): { supplierId: string } | { skip: "shared" | "osobno" | "unmapped" } => {
    const set = khToSuppliers.get(kh);
    if (!set?.size) return { skip: "unmapped" };
    if (set.size > 1) return { skip: "shared" };
    const supplierId = [...set][0]!;
    if (statsMode.get(supplierId) === "OSOBNO") return { skip: "osobno" };
    return { supplierId };
  };
}

/** Przelicza próbki 'subiekt' z kopii dokumentów i odświeża delivery_stats. */
export async function rebuildSubiektLeadTimeSamples(): Promise<
  Pick<SubiektLeadTimesSyncState, "docsStored" | "samples" | "samplesAssigned" | "counts" | "suppliers" | "statsRecomputed">
> {
  const { rows } = await query<{
    dok_id: number;
    typ: number;
    kh_id: number | null;
    data_wyst: string | null;
    data_mag: string | null;
    status: number | null;
    do_dok_id: number | null;
  }>(
    `SELECT dok_id, typ, kh_id, to_char(data_wyst, 'YYYY-MM-DD') AS data_wyst,
            to_char(data_mag, 'YYYY-MM-DD') AS data_mag, status, do_dok_id
     FROM subiekt_purchase_docs`
  );
  const analysis = analyzeSubiektLeadTimes(
    rows.map((r) => ({
      dokId: r.dok_id,
      typ: r.typ,
      khId: r.kh_id,
      dataWyst: r.data_wyst,
      dataMag: r.data_mag,
      status: r.status,
      doDokId: r.do_dok_id,
    }))
  );

  const assign = await loadKhAssignment();
  const skippedKh = { shared: new Set<number>(), osobno: new Set<number>(), unmapped: new Set<number>() };
  const assignedSuppliers = new Set<string>();
  const toInsert: Array<{ supplierId: string; s: SubiektLeadTimeAnalysis["samples"][number] }> = [];
  for (const s of analysis.samples) {
    const a = assign(s.khId);
    if ("skip" in a) {
      skippedKh[a.skip].add(s.khId);
      continue;
    }
    assignedSuppliers.add(a.supplierId);
    toInsert.push({ supplierId: a.supplierId, s });
  }

  await withClient(async (client) => {
    await client.query("BEGIN");
    try {
      // Próbki z Subiekta są w całości pochodną kopii dokumentów — podmieniamy komplet.
      await client.query(`DELETE FROM delivery_stats_samples WHERE source = 'subiekt'`);
      for (let i = 0; i < toInsert.length; i += DB_CHUNK) {
        const chunk = toInsert.slice(i, i + DB_CHUNK);
        await client.query(
          `INSERT INTO delivery_stats_samples
             (supplier_id, placement_date, delivery_date, first_delivery_date, business_days_full,
              business_days_first, order_type, is_teeth, source, subiekt_zd_id, subiekt_fz_id, date_corrected)
           SELECT supplier_id, placement_date, delivery_date, first_delivery_date, full_days,
                  first_days, 'Glowne', false, 'subiekt', zd_id, fz_id, corrected
           FROM unnest($1::uuid[], $2::date[], $3::date[], $4::date[], $5::int[], $6::int[],
                       $7::int[], $8::int[], $9::boolean[])
             AS t(supplier_id, placement_date, delivery_date, first_delivery_date, full_days,
                  first_days, zd_id, fz_id, corrected)`,
          [
            chunk.map((x) => x.supplierId),
            chunk.map((x) => x.s.placementDate),
            chunk.map((x) => x.s.deliveryDate),
            chunk.map((x) => x.s.firstDeliveryDate),
            chunk.map((x) => x.s.businessDaysFull),
            chunk.map((x) => x.s.businessDaysFirst),
            chunk.map((x) => x.s.zdId),
            chunk.map((x) => x.s.lastFzId),
            chunk.map((x) => x.s.dateCorrected),
          ]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  });

  const statsRecomputed = (await fetchDeliveryStatsFromSamplesEnabled())
    ? await recomputeAllDeliveryStatsFromSamples()
    : null;

  return {
    docsStored: rows.length,
    samples: analysis.samples.length,
    samplesAssigned: toInsert.length,
    counts: analysis.counts,
    suppliers: {
      assigned: assignedSuppliers.size,
      shared: skippedKh.shared.size,
      osobno: skippedKh.osobno.size,
      unmappedKh: skippedKh.unmapped.size,
    },
    statsRecomputed,
  };
}

async function writeState(state: SubiektLeadTimesSyncState): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: SUBIEKT_LEAD_TIMES_STATE_KEY, value: state });
  if (error) console.error("[subiekt-lead-times] state", error.message);
}

export async function readSubiektLeadTimesState(): Promise<SubiektLeadTimesSyncState | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", SUBIEKT_LEAD_TIMES_STATE_KEY)
    .maybeSingle();
  return (data?.value as SubiektLeadTimesSyncState | undefined) ?? null;
}

/** Trwa synchronizacja (np. pełna historia w tle) — blokada jeszcze aktywna. */
export async function isSubiektLeadTimesSyncRunning(): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM job_locks WHERE key = $1 AND locked_until > now()`,
    [LOCK_KEY]
  );
  return rows.length > 0;
}

export async function runSubiektLeadTimesSync(
  mode: SubiektLeadTimesSyncMode
): Promise<SubiektLeadTimesSyncState | { skipped: "locked" }> {
  // Pełna historia: ~250 stron z Subiekta — kilka minut.
  if (!(await tryAcquireLock(LOCK_KEY, 30 * 60, `subiekt-lead-times:${mode}`))) {
    return { skipped: "locked" };
  }
  const started = Date.now();
  let docsFetched = 0;
  try {
    // Bez pełnej kopii łańcuchy braków z rodzicem sprzed okna liczyłyby się od daty braków.
    if (mode === "incremental") {
      const { rows } = await query<{ n: string }>(`SELECT count(*) AS n FROM subiekt_purchase_docs`);
      if (Number(rows[0]?.n ?? 0) === 0) mode = "full";
    }
    for (const [od, doo] of syncWindows(mode)) {
      docsFetched += await syncWindow(SUBIEKT_DOC_TYPE_ZD, od, doo);
      docsFetched += await syncWindow(SUBIEKT_DOC_TYPE_FZ, od, doo);
    }
    const rebuilt = await rebuildSubiektLeadTimeSamples();
    const state: SubiektLeadTimesSyncState = {
      at: new Date().toISOString(),
      mode,
      ok: true,
      durationMs: Date.now() - started,
      docsFetched,
      ...rebuilt,
    };
    await writeState(state);
    return state;
  } catch (e) {
    const state: SubiektLeadTimesSyncState = {
      at: new Date().toISOString(),
      mode,
      ok: false,
      durationMs: Date.now() - started,
      docsFetched,
      docsStored: 0,
      samples: 0,
      samplesAssigned: 0,
      statsRecomputed: null,
      counts: null,
      suppliers: null,
      error: e instanceof Error ? e.message.slice(0, 500) : "unknown",
    };
    await writeState(state);
    return state;
  } finally {
    await releaseLock(LOCK_KEY);
  }
}
