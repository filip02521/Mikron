/**
 * Korekty sprzedaży (KFS) — Subiekt liczy `sprzedazOkres` z FS + PA + WZ i nie odejmuje zwrotów.
 * Kopia pozycji KFS w `subiekt_sales_corrections` (mig. 202), odczyt nocny z `/documents?typ=6`;
 * silnik odejmuje je od sprzedaży w oknie Kreatora i od okien profilu 12 × 30 d.
 * Reguły czyste (`applySalesCorrectionsToLine`, `subtractCorrectionsFromWindows`), I/O osobno.
 */
import { query } from "@/lib/db/pool";
import { mapPool } from "@/lib/async/map-pool";
import { getSubiektDocument, searchSubiektDocuments } from "@/lib/subiekt/api";
import { zdSalesProfileWindows } from "@/lib/orders/zd-sales-profile";

/** dok_Typ faktury korygującej sprzedaż w Subiekcie. */
export const SUBIEKT_DOC_TYPE_KFS = 6;
/** Pierwszy odczyt sięga tyle dni wstecz (profil 12 × 30 d + okno Kreatora). */
export const SALES_CORRECTIONS_BACKFILL_DAYS = 400;
/** Kolejne odczyty cofają się o tyle dni od ostatniego zapisanego dokumentu (KFS z datą wsteczną). */
export const SALES_CORRECTIONS_OVERLAP_DAYS = 14;

export type SalesCorrectionsMeta = {
  /** Sztuki karty odjęte od sprzedaży w oknie. */
  pieces: number;
};

const shiftKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Linia API po odjęciu zwrotów: sprzedaż, tempo i część celu zależna od sprzedaży w dół
 * (cel z API = tempo × dni zapasu + zapasMin; zapasMin bez zmian). Nigdy poniżej zera.
 */
export function applySalesCorrectionsToLine<
  T extends { sprzedazOkres?: number | null; sprzedazDziennie?: number | null; celZapasu?: number | null },
>(line: T, pieces: number, dniOkresu: number, dniZapasu: number, zapasMin: number): T & { salesCorrections?: SalesCorrectionsMeta } {
  const raw = Math.max(0, Number(line.sprzedazOkres) || 0);
  const cut = Math.min(raw, Math.max(0, Number(pieces) || 0));
  if (!(cut > 0)) return line;
  const days = Math.max(1, dniOkresu);
  const celRaw = Math.max(0, Number(line.celZapasu) || 0);
  const min = Math.min(Math.max(0, zapasMin), celRaw);
  const sales = raw - cut;
  return {
    ...line,
    sprzedazOkres: sales,
    sprzedazDziennie: sales / days,
    celZapasu: Math.round(Math.max(min, celRaw - (cut / days) * Math.max(1, dniZapasu)) * 1e6) / 1e6,
    salesCorrections: { pieces: cut },
  };
}

/** Okna profilu (od najstarszego) po odjęciu zwrotów z dni w każdym oknie; okno nie mniej niż 0. */
export function subtractCorrectionsFromWindows(
  windows: readonly number[],
  corrections: Iterable<readonly [string, number]>,
  endDate: string
): number[] {
  const ranges = zdSalesProfileWindows(endDate);
  const out = windows.map((x) => Math.max(0, Number(x) || 0));
  const off = ranges.length - out.length;
  for (const [day, qty] of corrections) {
    const k = ranges.findIndex((r) => day >= r.dataOd && day <= r.dataDo) - off;
    if (k >= 0 && k < out.length && qty > 0) out[k] = Math.max(0, out[k]! - qty);
  }
  return out;
}

/** Zwroty per towar w oknie [dataOd, dataDo] (sztuki karty). */
export async function loadSalesCorrectionsByTwId(input: {
  twIds: readonly number[];
  dataOd: string;
  dataDo: string;
}): Promise<Map<number, number>> {
  const ids = [...new Set(input.twIds.map((x) => Math.trunc(Number(x) || 0)).filter((x) => x > 0))];
  const out = new Map<number, number>();
  if (!ids.length) return out;
  const res = await query<{ tw: number; qty: string }>(
    `SELECT subiekt_tw_id AS tw, sum(qty)::text AS qty
       FROM subiekt_sales_corrections
      WHERE subiekt_tw_id = ANY($1::int[]) AND dok_date BETWEEN $2::date AND $3::date
      GROUP BY subiekt_tw_id`,
    [ids, input.dataOd, input.dataDo]
  );
  for (const r of res.rows) out.set(Math.trunc(Number(r.tw)), Number(r.qty) || 0);
  return out;
}

/** Zwroty per towar dzień po dniu w zakresie 12 okien profilu kończących się `endDate`. */
export async function loadSalesCorrectionsByDay(input: {
  twIds: readonly number[];
  endDate: string;
}): Promise<Map<number, Array<readonly [string, number]>>> {
  const ids = [...new Set(input.twIds.map((x) => Math.trunc(Number(x) || 0)).filter((x) => x > 0))];
  const out = new Map<number, Array<readonly [string, number]>>();
  if (!ids.length) return out;
  const ranges = zdSalesProfileWindows(input.endDate);
  const res = await query<{ tw: number; day: string; qty: string }>(
    `SELECT subiekt_tw_id AS tw, to_char(dok_date, 'YYYY-MM-DD') AS day, sum(qty)::text AS qty
       FROM subiekt_sales_corrections
      WHERE subiekt_tw_id = ANY($1::int[]) AND dok_date BETWEEN $2::date AND $3::date
      GROUP BY subiekt_tw_id, dok_date`,
    [ids, ranges[0]!.dataOd, ranges[ranges.length - 1]!.dataDo]
  );
  for (const r of res.rows) {
    const tw = Math.trunc(Number(r.tw));
    out.set(tw, [...(out.get(tw) ?? []), [r.day, Number(r.qty) || 0]]);
  }
  return out;
}

/**
 * Nocny odczyt KFS: lista dokumentów od ostatniego zapisanego (z zakładką), pozycje każdego nowego
 * dokumentu. Zapis idempotentny (upsert); przerwanie przez budżet czasu — kolejna noc dokończy.
 */
export async function syncSalesCorrections(input: {
  todayKey: string;
  maxDurationMs?: number;
}): Promise<{ docs: number; lines: number; from: string; timedOut: boolean }> {
  const started = Date.now();
  const budget = input.maxDurationMs ?? 90_000;
  const last = await query<{ d: string | null }>(`SELECT to_char(max(dok_date), 'YYYY-MM-DD') AS d FROM subiekt_sales_corrections`);
  const lastKey = last.rows[0]?.d ?? null;
  const from = lastKey
    ? shiftKey(lastKey, -SALES_CORRECTIONS_OVERLAP_DAYS)
    : shiftKey(input.todayKey, -SALES_CORRECTIONS_BACKFILL_DAYS);
  const known = new Set<number>(
    (
      await query<{ dok_id: number }>(`SELECT DISTINCT dok_id FROM subiekt_sales_corrections WHERE dok_date >= $1::date`, [from])
    ).rows.map((r) => Number(r.dok_id))
  );
  const docIds: Array<{ id: number; date: string | null; nr: string | null }> = [];
  let page = 1;
  let totalPages: number;
  let timedOut = false;
  do {
    const list = await searchSubiektDocuments({ typ: SUBIEKT_DOC_TYPE_KFS, dataOd: from, page, pageSize: 200 });
    for (const d of list.data ?? []) {
      const id = Math.trunc(Number((d as { dok_Id?: unknown }).dok_Id));
      if (!(id > 0) || known.has(id)) continue;
      docIds.push({
        id,
        date: String((d as { dok_DataWyst?: unknown }).dok_DataWyst ?? "").slice(0, 10) || null,
        nr: (d as { dok_NrPelny?: string | null }).dok_NrPelny ?? null,
      });
    }
    totalPages = list.pagination?.totalPages ?? 1;
    page += 1;
    if (Date.now() - started > budget) {
      timedOut = true;
      break;
    }
  } while (page <= totalPages);

  // Najstarsze najpierw: przerwany przebieg zostawia ciągły zakres (zakładka = max dok_date).
  docIds.sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id);
  let docs = 0;
  let lines = 0;
  await mapPool(docIds, 3, async (d) => {
    if (timedOut || Date.now() - started > budget) {
      timedOut = true;
      return;
    }
    let doc;
    try {
      doc = await getSubiektDocument(d.id);
    } catch {
      return; // 404 / timeout — następnej nocy
    }
    const byTw = new Map<number, number>();
    for (const p of doc.dok_Pozycja ?? []) {
      const tw = Math.trunc(Number(p.ob_TowId) || 0);
      const q = Math.abs(Number(p.ob_Ilosc) || 0);
      if (tw > 0 && q > 0) byTw.set(tw, (byTw.get(tw) ?? 0) + q);
    }
    const date = String(doc.dok_DataWyst ?? d.date ?? "").slice(0, 10);
    if (!date) return;
    const rows = [...byTw];
    if (!rows.length) return;
    await query(
      `INSERT INTO subiekt_sales_corrections (dok_id, subiekt_tw_id, dok_nr, dok_date, qty, synced_at)
       SELECT $1, t.tw, $2, $3::date, t.qty, now()
         FROM unnest($4::int[], $5::numeric[]) AS t(tw, qty)
       ON CONFLICT (dok_id, subiekt_tw_id) DO UPDATE SET qty = EXCLUDED.qty, dok_date = EXCLUDED.dok_date, dok_nr = EXCLUDED.dok_nr, synced_at = now()`,
      [d.id, doc.dok_NrPelny ?? d.nr, date, rows.map(([tw]) => tw), rows.map(([, q]) => q)]
    );
    docs += 1;
    lines += rows.length;
  });
  return { docs, lines, from, timedOut };
}
