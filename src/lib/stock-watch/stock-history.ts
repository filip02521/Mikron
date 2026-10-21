/**
 * Dzienna historia stanów — zapis w nocnym przebiegu Braków, odczyt w silniku Kreatora.
 *
 * W dniach braku Subiekt notuje tylko sprzedaż, która zeszła, więc tempo z okna zaniża
 * popyt dokładnie wtedy, gdy towaru nie ma (symulacja: przy dostawie 30 dni powrót po
 * braku trwał miesiącami). Z historią tempo liczymy na dniach ze stanem.
 *
 * Dzień obserwacji = poranny stan (przed sprzedażą tego dnia): dostępne ≤ 0 → dzień braku.
 * Liczą się tylko dni robocze (pn–pt) — brak w weekend nie gubi sprzedaży.
 */

import { query } from "@/lib/db/pool";

/** Historia starsza niż rok + zapas na okna 90 d nie jest potrzebna. */
export const STOCK_HISTORY_RETENTION_DAYS = 400;

export const ZD_STOCKOUT_ADJUST = {
  /** Zapisane dni okna (udział) potrzebne do korekty — luki to nie „ze stanem”. */
  minRecordedShare: 0.8,
  /** Min. dni ze stanem — przy krótszej obserwacji tempo jest zbyt losowe. */
  minInStockDays: 7,
  /** Maks. podbicie tempa (brak przez ponad połowę okna nie mnoży sprzedaży dalej). */
  maxFactor: 2,
} as const;

export type StockHistoryWindow = { recordedDays: number; outDays: number };

export type StockoutAdjustMeta = {
  windowDays: number;
  recordedDays: number;
  outDays: number;
  /** Mnożnik sprzedaży w oknie (> 1). */
  factor: number;
};

/**
 * Mnożnik tempa: dni okna / dni ze stanem. null = bez korekty (mało historii, brak dni
 * braku, za mało dni ze stanem).
 */
export function computeStockoutSalesFactor(input: {
  windowDays: number;
  recordedDays: number;
  outDays: number;
}): StockoutAdjustMeta | null {
  const p = ZD_STOCKOUT_ADJUST;
  const windowDays = Math.max(1, Math.round(input.windowDays));
  const recorded = Math.max(0, Math.min(windowDays, Math.round(input.recordedDays)));
  const out = Math.max(0, Math.min(recorded, Math.round(input.outDays)));
  if (out === 0) return null;
  if (recorded < windowDays * p.minRecordedShare) return null;
  const inStock = recorded - out;
  if (inStock < p.minInStockDays) return null;
  const factor = Math.min(p.maxFactor, recorded / inStock);
  if (!(factor > 1 + 1e-9)) return null;
  return { windowDays, recordedDays: recorded, outDays: out, factor };
}

/**
 * Sprzedaż, tempo i cel (część zależna od sprzedaży) × mnożnik — jak wygładzenie profilu,
 * tylko w górę. Cel z API = tempo × dni zapasu + zapasMin; zapasMin się nie skaluje.
 */
export function applyStockoutAdjustToLine<
  T extends {
    sprzedazOkres?: number | null;
    sprzedazDziennie?: number | null;
    celZapasu?: number | null;
  },
>(line: T, meta: StockoutAdjustMeta, zapasMin: number): T & { stockoutAdjust: StockoutAdjustMeta } {
  const f = meta.factor;
  const celRaw = Math.max(0, Number(line.celZapasu) || 0);
  const min = Math.min(Math.max(0, zapasMin), celRaw);
  return {
    ...line,
    sprzedazOkres: Math.max(0, Number(line.sprzedazOkres) || 0) * f,
    sprzedazDziennie: Math.max(0, Number(line.sprzedazDziennie) || 0) * f,
    celZapasu: Math.round(((celRaw - min) * f + min) * 1e6) / 1e6,
    stockoutAdjust: meta,
  };
}

/** Poranny stan towarów — pierwszy zapis dnia wygrywa (odświeżenie po ZD go nie nadpisuje). */
export async function recordStockDailySnapshot(
  dayKey: string,
  rows: readonly { twId: number; stock: number; reserved: number; available: number }[]
): Promise<number> {
  const clean = rows.filter((r) => Number.isInteger(r.twId) && r.twId > 0);
  if (!clean.length) return 0;
  let written = 0;
  for (let i = 0; i < clean.length; i += 1000) {
    const chunk = clean.slice(i, i + 1000);
    const res = await query(
      `INSERT INTO stock_daily_history (subiekt_tw_id, day, stock_qty, reserved_qty, available_qty)
       SELECT x.tw, $1::date, x.stock, x.reserved, x.available
         FROM unnest($2::int[], $3::numeric[], $4::numeric[], $5::numeric[]) AS x(tw, stock, reserved, available)
       ON CONFLICT (subiekt_tw_id, day) DO NOTHING`,
      [
        dayKey,
        chunk.map((r) => r.twId),
        chunk.map((r) => finite(r.stock)),
        chunk.map((r) => finite(r.reserved)),
        chunk.map((r) => finite(r.available)),
      ]
    );
    written += res.rowCount ?? 0;
  }
  return written;
}

/** Dni robocze (pn–pt) w oknie [dataOd, dataDo], włącznie. */
export function businessDaysInWindow(dataOd: string, dataDo: string): number {
  const od = Date.parse(`${dataOd.slice(0, 10)}T00:00:00Z`);
  const doo = Date.parse(`${dataDo.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(od) || !Number.isFinite(doo) || doo < od) return 0;
  let n = 0;
  for (let t = od; t <= doo; t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) n += 1;
  }
  return n;
}

/** Dni robocze zapisane i dni braku w oknie [dataOd, dataDo] (włącznie) per towar. */
export async function loadStockHistoryWindow(
  twIds: readonly number[],
  dataOd: string,
  dataDo: string
): Promise<Map<number, StockHistoryWindow>> {
  const ids = [...new Set(twIds.filter((t) => Number.isInteger(t) && t > 0))];
  const out = new Map<number, StockHistoryWindow>();
  if (!ids.length) return out;
  const res = await query<{ tw: number; recorded: string; out_days: string }>(
    `SELECT subiekt_tw_id AS tw,
            count(*)::text AS recorded,
            count(*) FILTER (WHERE available_qty <= 0)::text AS out_days
       FROM stock_daily_history
      WHERE subiekt_tw_id = ANY($1::int[])
        AND day BETWEEN $2::date AND $3::date
        AND extract(isodow FROM day) < 6
      GROUP BY subiekt_tw_id`,
    [ids, dataOd, dataDo]
  );
  for (const r of res.rows) {
    out.set(Number(r.tw), { recordedDays: Number(r.recorded) || 0, outDays: Number(r.out_days) || 0 });
  }
  return out;
}

export async function pruneStockDailyHistory(): Promise<number> {
  const res = await query(
    `DELETE FROM stock_daily_history WHERE day < (now() AT TIME ZONE 'Europe/Warsaw')::date - $1::int`,
    [STOCK_HISTORY_RETENTION_DAYS]
  );
  return res.rowCount ?? 0;
}

function finite(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
