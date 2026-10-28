/**
 * Zaległe otwarte ZD — po terminie realizacji (plus karencja) albo bez terminu i stare —
 * nie liczą się jako „w drodze”. Subiekt (`/orders/zd/estimate`) sumuje każde otwarte ZD
 * z 12 miesięcy, więc jedno martwe ZD zerowało Do ZD miesiącami (28.10.2026: 60 ZD po terminie,
 * najstarsze z grudnia 2025).
 *
 * Źródło: kopia nagłówków `subiekt_zd_index` (status, termin) + linie `zd_purchase_lines`
 * (jednostki dokumentu, jak `otwarteZd` z API). Reguła czysta (`isZdStaleOpenDoc`), odczyt osobno.
 */
import { query } from "@/lib/db/pool";
import { getSubiektZdDocumentCached } from "@/lib/subiekt/subiekt-runtime-cache";
import { parseZdFulfillmentDeadline } from "@/lib/subiekt/zd-fulfillment-date";
import { mapPool } from "@/lib/async/map-pool";

/** Dni po terminie realizacji, po których ZD przestaje być „w drodze”. */
export const ZD_STALE_OPEN_GRACE_DAYS = 7;
/** ZD bez terminu: zaległe po tylu dniach od wystawienia. */
export const ZD_STALE_OPEN_NO_DEADLINE_DAYS = 60;
/** Statusy otwartego ZD w Subiekcie (jak `otwarteZd` z API). */
const OPEN_STATUSES = [5, 6, 7];

export type ZdStaleOpenDoc = {
  dokId: number;
  dokNr: string | null;
  dokDate: string | null;
  termin: string | null;
  /** Jednostki dokumentu ZD tego towaru. */
  units: number;
};

export type ZdStaleOpenZd = {
  /** Jednostki dokumentu odjęte od „w drodze” (nie więcej niż otwarte ZD z API). */
  units: number;
  docs: ZdStaleOpenDoc[];
};

const shiftKey = (key: string, days: number) =>
  new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Czysta reguła: otwarte ZD jest zaległe, gdy termin + karencja minął, a bez terminu — gdy jest stare. */
export function isZdStaleOpenDoc(
  doc: { status: number | null; termin: string | null; dokDate: string | null },
  todayKey: string
): boolean {
  if (doc.status == null || !OPEN_STATUSES.includes(doc.status)) return false;
  if (doc.termin) return doc.termin < shiftKey(todayKey, -ZD_STALE_OPEN_GRACE_DAYS);
  if (doc.dokDate) return doc.dokDate < shiftKey(todayKey, -ZD_STALE_OPEN_NO_DEADLINE_DAYS);
  return false;
}

/** Zaległe ZD per towar (jednostki dokumentu) dla listy towarów. Brak kopii = pusta mapa. */
export async function loadStaleOpenZdByTwId(
  twIds: readonly number[],
  todayKey: string
): Promise<Map<number, ZdStaleOpenZd>> {
  const ids = [...new Set(twIds.map((x) => Math.trunc(Number(x) || 0)).filter((x) => x > 0))];
  const out = new Map<number, ZdStaleOpenZd>();
  if (!ids.length) return out;
  // 12 miesięcy jak zakres `otwarteZd` w API — starsze ZD Subiekt i tak nie liczy.
  const res = await query<{
    tw: number;
    dok_id: number;
    dok_nr: string | null;
    dok_date: string | null;
    termin: string | null;
    status: number | null;
    qty: string;
  }>(
    `SELECT l.subiekt_tw_id AS tw, l.dok_id, l.dok_nr, l.qty::text AS qty,
            to_char(i.dok_data_wyst::date, 'YYYY-MM-DD') AS dok_date,
            to_char(i.dok_termin_realizacji::date, 'YYYY-MM-DD') AS termin,
            i.dok_status AS status
       FROM zd_purchase_lines l
       JOIN subiekt_zd_index i ON i.dok_id = l.dok_id
      WHERE l.subiekt_tw_id = ANY($1::int[])
        AND l.qty > 0
        AND i.dok_status = ANY($2::int[])
        AND i.dok_data_wyst::date >= ($3::date - interval '12 months')`,
    [ids, OPEN_STATUSES, todayKey]
  );
  for (const r of res.rows) {
    if (!isZdStaleOpenDoc({ status: r.status, termin: r.termin, dokDate: r.dok_date }, todayKey)) continue;
    const units = Number(r.qty) || 0;
    if (!(units > 0)) continue;
    const tw = Math.trunc(Number(r.tw));
    const cur = out.get(tw) ?? { units: 0, docs: [] };
    cur.units += units;
    cur.docs.push({ dokId: Number(r.dok_id), dokNr: r.dok_nr, dokDate: r.dok_date, termin: r.termin, units });
    out.set(tw, cur);
  }
  return out;
}

/**
 * Linia API bez zaległych ZD w „w drodze”; meta `staleOpenZd` do karty i „Dlaczego tyle”.
 * Odejmujemy nie więcej niż API policzyło (kopia może znać ZD, które Subiekt już zamknął).
 */
export function applyStaleOpenZdToLine<T extends { otwarteZd?: number | null }>(
  line: T,
  stale: ZdStaleOpenZd | null | undefined
): T & { staleOpenZd?: ZdStaleOpenZd } {
  if (!stale || !(stale.units > 0)) return line;
  const open = Math.max(0, Number(line.otwarteZd) || 0);
  const units = Math.min(open, stale.units);
  if (!(units > 0)) return line;
  return { ...line, otwarteZd: open - units, staleOpenZd: { units, docs: stale.docs } };
}

/**
 * Nocne odświeżenie statusów zaległych ZD w kopii: indeks przepisuje tylko ZD z ostatnich 90 dni,
 * a zaległe bywają starsze — ZD zamknięte w Subiekcie zostałoby „otwarte” na zawsze.
 */
export async function refreshOverdueOpenZdIndex(input: {
  todayKey: string;
  limit?: number;
}): Promise<{ checked: number; closed: number }> {
  const limit = Math.max(1, Math.trunc(input.limit ?? 150));
  const res = await query<{ dok_id: number }>(
    `SELECT dok_id FROM subiekt_zd_index
      WHERE dok_status = ANY($1::int[])
        AND (dok_termin_realizacji::date < $2::date - $3::int
             OR (dok_termin_realizacji IS NULL AND dok_data_wyst::date < $2::date - $4::int))
        AND dok_data_wyst::date >= ($2::date - interval '12 months')
      ORDER BY dok_data_wyst::date ASC
      LIMIT $5`,
    [OPEN_STATUSES, input.todayKey, ZD_STALE_OPEN_GRACE_DAYS, ZD_STALE_OPEN_NO_DEADLINE_DAYS, limit]
  );
  let closed = 0;
  await mapPool(res.rows, 3, async (r) => {
    let doc;
    try {
      doc = await getSubiektZdDocumentCached(Number(r.dok_id), { forceFresh: true });
    } catch {
      return; // 404 / timeout: status zostaje, sprawdzimy następnej nocy
    }
    const status = doc.dok_Status ?? null;
    await query(
      `UPDATE subiekt_zd_index SET dok_status = $2, dok_termin_realizacji = $3, updated_at = now() WHERE dok_id = $1`,
      [Number(r.dok_id), status, parseZdFulfillmentDeadline(doc)]
    );
    if (status != null && !OPEN_STATUSES.includes(status)) closed += 1;
  });
  return { checked: res.rows.length, closed };
}
